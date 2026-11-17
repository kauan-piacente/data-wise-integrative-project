package com.senai.backend_java.services;

import static com.senai.backend_java.services.Colunas.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.senai.backend_java.dto.ClienteDTO;
import com.senai.backend_java.dto.UploadDTO.LinhaEnvio;

/**
 * Valida a planilha linha a linha usando as regras de negócio do sistema.
 *
 * <p>Cada linha termina com:
 * <ul>
 *   <li><b>erros</b>  – bloqueiam a linha (ela não segue para o serviço de ETL em Python);</li>
 *   <li><b>avisos</b> – apenas informam ajustes que serão realizados na padronização.</li>
 * </ul>
 */
@Service
public class ClienteValidacaoService {

    /**
     * Resultado da validação de uma linha da planilha.
     *
     * @param numero  número da linha no arquivo original
     * @param valores mapa coluna -> valor limpo
     * @param erros   problemas impeditivos encontrados na linha
     * @param avisos  observações que não impedem o envio ao ETL
     */
    public record ResultadoLinha(int numero, Map<String, String> valores, List<String> erros, List<String> avisos) {
        public boolean valida() {
            return erros.isEmpty();
        }
    }

    private static final Pattern RE_CODIGO = Pattern.compile("^[A-Za-z0-9_-]{1,60}$");
    private static final Pattern RE_UF = Pattern.compile("^[A-Za-z]{2}$");
    private static final Pattern DATA_ISO = Pattern.compile("^(\\d{4}-\\d{2}-\\d{2})([T ].*)?$");
    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("d/M/uuuu");
    private static final BigDecimal LIMITE_FATURAMENTO = new BigDecimal("1000000000000");
    private static final Set<String> NIVEIS = Set.of("A", "B", "C");
    private static final int ANO_MINIMO = 1990;

    /**
     * Valida todas as linhas recebidas na ordem em que aparecem na planilha.
     */
    public List<ResultadoLinha> validar(List<LinhaEnvio> linhas) {
        List<ResultadoLinha> saida = new ArrayList<>();
        Map<String, Integer> codigos = new HashMap<>();
        Map<String, Integer> conteudos = new HashMap<>();
        Map<String, String> codigoDoConteudo = new HashMap<>();
        LocalDate hoje = LocalDate.now();

        for (int i = 0; i < linhas.size(); i++) {
            LinhaEnvio linha = linhas.get(i);
            int numero = linha.numeroLinha() == null ? i + 2 : linha.numeroLinha();
            List<String> erros = new ArrayList<>();
            List<String> avisos = new ArrayList<>();
            Map<String, String> valores = new LinkedHashMap<>();
            Map<String, String> campos = paraMapa(linha);

            // Limpeza de espaços extras nas extremidades e no meio do texto, além da checagem de tamanho máximo
            for (String campo : TODAS) {
                String bruto = campos.get(campo);
                String limpo = bruto == null ? "" : bruto.strip().replaceAll("\\s{2,}", " ");
                if (bruto != null && !limpo.equals(bruto)) {
                    avisos.add(campo + ": espaços extras removidos");
                }
                valores.put(campo, limpo);
                Integer max = TAMANHO_MAXIMO.get(campo);
                if (max != null && limpo.length() > max) {
                    erros.add(campo + ": excede " + max + " caracteres");
                    valores.put(campo, limpo.substring(0, max));
                }
            }

            // Verificação de preenchimento dos campos obrigatórios
            for (String campo : OBRIGATORIAS) {
                if (valores.get(campo).isEmpty()) erros.add(campo + ": campo obrigatório vazio");
            }

            // Validação de formato e duplicidade do código do cliente (sem diferenciar maiúsculas e minúsculas)
            String codigo = valores.get(CODIGO);
            if (!codigo.isEmpty()) {
                if (!RE_CODIGO.matcher(codigo).matches()) {
                    erros.add(CODIGO + ": use apenas letras, números, '-' ou '_'");
                }
                Integer primeira = codigos.putIfAbsent(codigo.toUpperCase(Locale.ROOT), numero);
                if (primeira != null) {
                    erros.add(CODIGO + ": código duplicado (já usado na linha " + primeira + ")");
                }
            }

            // Validação e aviso de padronização do segmento empresarial
            String segmento = valores.get(SEGMENTO);
            if (!segmento.isEmpty()) {
                String padrao = Padronizacao.segmento(segmento);
                if (padrao == null) {
                    erros.add(SEGMENTO + ": '" + segmento
                            + "' não reconhecido (use Indústria, Comércio, Serviços, Saúde, Educação ou Tecnologia)");
                } else if (!padrao.equals(segmento)) {
                    avisos.add(SEGMENTO + ": '" + segmento + "' será padronizado para " + padrao);
                }
            }

            // Aviso quando o nome do consultor precisar ser formatado com iniciais maiúsculas
            String consultor = valores.get(CONSULTOR);
            if (!consultor.isEmpty()) {
                String ajustado = Padronizacao.tituloNome(consultor);
                if (!ajustado.equals(consultor)) {
                    avisos.add(CONSULTOR + ": '" + consultor + "' será padronizado para " + ajustado);
                }
            }

            // Validação do nível do cliente (A, B ou C)
            String nivel = valores.get(NIVEL);
            if (!nivel.isEmpty() && !NIVEIS.contains(nivel)) {
                erros.add(NIVEL + ": '" + nivel + "' inválido (use A, B ou C em maiúsculo)");
            }

            // Validação e normalização do faturamento anual
            String fat = valores.get(FATURAMENTO);
            if (!fat.isEmpty()) {
                Optional<BigDecimal> valor = lerDecimal(fat);
                if (valor.isEmpty()) {
                    erros.add(FATURAMENTO + ": '" + fat + "' não é um número");
                } else if (valor.get().signum() <= 0) {
                    erros.add(FATURAMENTO + ": deve ser maior do que zero");
                } else if (valor.get().compareTo(LIMITE_FATURAMENTO) >= 0) {
                    erros.add(FATURAMENTO + ": valor acima do permitido");
                } else {
                    valores.put(FATURAMENTO, valor.get().setScale(2, RoundingMode.HALF_UP).toPlainString());
                }
            }

            // Verificação da lista de serviços contratados
            String servicos = valores.get(SERVICOS);
            if (!servicos.isEmpty() && Arrays.stream(servicos.split(";")).allMatch(String::isBlank)) {
                erros.add(SERVICOS + ": nenhum serviço informado");
            }

            // Validação e normalização da data de contratação
            String data = valores.get(DATA);
            if (!data.isEmpty()) {
                Optional<LocalDate> d = lerData(data);
                if (d.isEmpty() || d.get().getYear() < ANO_MINIMO) {
                    erros.add(DATA + ": '" + data + "' não é uma data válida (use dd/mm/aaaa ou aaaa-mm-dd)");
                } else {
                    if (d.get().isAfter(hoje)) avisos.add(DATA + ": data no futuro");
                    valores.put(DATA, d.get().toString());
                }
            }

            // Validação da sigla de UF quando informada
            String uf = valores.get(UF);
            if (!uf.isEmpty() && !RE_UF.matcher(uf).matches()) {
                erros.add(UF + ": '" + uf + "' inválida (use a sigla com 2 letras)");
            }

            // Detecção de possível duplicidade de cliente cadastrado com código diferente
            if (!codigo.isEmpty() && !valores.get(NOME).isEmpty()) {
                String chave = valores.get(NOME).toLowerCase(Locale.ROOT) + "|" + valores.get(FATURAMENTO) + "|" + valores.get(DATA);
                Integer anterior = conteudos.putIfAbsent(chave, numero);
                if (anterior != null && !codigo.equalsIgnoreCase(codigoDoConteudo.get(chave))) {
                    avisos.add(NOME + ": possível duplicidade (mesmo nome, faturamento e data da linha " + anterior + ")");
                }
                codigoDoConteudo.putIfAbsent(chave, codigo);
            }

            saida.add(new ResultadoLinha(numero, valores, erros, avisos));
        }
        return saida;
    }

    /**
     * Converte texto numérico ou monetário (padrão brasileiro ou americano) em BigDecimal.
     */
    static Optional<BigDecimal> lerDecimal(String texto) {
        String t = texto.replace("R$", "")
                .replace('\u00A0', ' ')
                .replaceAll("\\s", "");
        if (t.isEmpty() || !t.matches("^-?[0-9.,]+$")) return Optional.empty();
        boolean ponto = t.contains("."), virgula = t.contains(",");
        if (ponto && virgula) {
            if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(".", "").replace(',', '.');
            else t = t.replace(",", "");
        } else if (virgula) {
            t = t.chars().filter(c -> c == ',').count() > 1 ? t.replace(",", "") : t.replace(',', '.');
        } else if (ponto && t.matches("^-?\\d{1,3}(\\.\\d{3})+$")) {
            t = t.replace(".", "");
        }
        try {
            return Optional.of(new BigDecimal(t));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /**
     * Faz a leitura de datas nos formatos aaaa-mm-dd ou dd/mm/aaaa.
     */
    static Optional<LocalDate> lerData(String texto) {
        try {
            var iso = DATA_ISO.matcher(texto);
            if (iso.matches()) return Optional.of(LocalDate.parse(iso.group(1)));
            return Optional.of(LocalDate.parse(texto, BR));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    /**
     * Valida uma lista de ClienteDTO e retorna os objetos já padronizados.
     */
    public List<ClienteDTO> validarEPreparar(List<ClienteDTO> clientes) {
        List<LinhaEnvio> linhas = new ArrayList<>(clientes.size());
        for (int i = 0; i < clientes.size(); i++) {
            ClienteDTO c = clientes.get(i);
            linhas.add(new LinhaEnvio(
                    i + 2,
                    c.codigoCliente(),
                    c.nomeCliente(),
                    c.consultor(),
                    c.segmento(),
                    c.nivelCliente(),
                    c.faturamentoAnual() == null ? null : BigDecimal.valueOf(c.faturamentoAnual()).toPlainString(),
                    c.servicosContratados(),
                    c.dataContratacao() == null ? null : c.dataContratacao().toString(),
                    c.cidade(),
                    c.uf()));
        }

        List<ResultadoLinha> resultados = validar(linhas);
        List<ClienteDTO> preparados = new ArrayList<>(resultados.size());
        for (ResultadoLinha r : resultados) {
            if (!r.valida()) {
                throw new IllegalArgumentException("Linha " + r.numero() + ": " + String.join(" | ", r.erros()));
            }
            Map<String, String> v = r.valores();
            preparados.add(new ClienteDTO(
                    v.get(CODIGO),
                    v.get(NOME),
                    Padronizacao.tituloNome(v.get(CONSULTOR)),
                    Padronizacao.segmento(v.get(SEGMENTO)),
                    v.get(NIVEL),
                    Double.valueOf(v.get(FATURAMENTO)),
                    v.get(SERVICOS),
                    LocalDate.parse(v.get(DATA)),
                    v.get(CIDADE).isEmpty() ? null : v.get(CIDADE),
                    v.get(UF).isEmpty() ? null : v.get(UF).toUpperCase(Locale.ROOT)));
        }
        return preparados;
    }

    /**
     * Converte um registro LinhaEnvio em mapa coluna -> texto para facilitar a validação.
     */
    private static Map<String, String> paraMapa(LinhaEnvio e) {
        Map<String, String> m = new HashMap<>();
        m.put(CODIGO, e.codigoCliente());
        m.put(NOME, e.nomeCliente());
        m.put(CONSULTOR, e.consultor());
        m.put(SEGMENTO, e.segmento());
        m.put(NIVEL, e.nivelCliente());
        m.put(FATURAMENTO, e.faturamentoAnual());
        m.put(SERVICOS, e.servicosContratados());
        m.put(DATA, e.dataContratacao());
        m.put(CIDADE, e.cidade());
        m.put(UF, e.uf());
        return m;
    }
}
