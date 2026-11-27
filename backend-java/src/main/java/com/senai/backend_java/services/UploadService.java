package com.senai.backend_java.services;

import static com.senai.backend_java.services.Colunas.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.senai.backend_java.config.ApiException;
import com.senai.backend_java.config.AppProperties;
import com.senai.backend_java.dto.UploadDTO.EnvioValidadasRequest;
import com.senai.backend_java.dto.UploadDTO.LinhaEnvio;
import com.senai.backend_java.services.ClienteValidacaoService.ResultadoLinha;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service                                                                            // serviço do Spring
public class UploadService {                                                        // REGRA DO UPLOAD: valida e ENCAMINHA ao Python
    private final ClienteValidacaoService validacao;                                // validador (as mesmas regras do front)
    private final AppProperties props;                                              // configurações
    private final PythonEtlService python;                                          // envia os dados ao Python
    private final JdbcTemplate jdbc;                                                // consulta lotes e estatísticas no PostgreSQL
    private final ObjectMapper json;                                                // parseia o JSON gravado em estatistica_lote

    public UploadService(ClienteValidacaoService validacao, AppProperties props,
                         PythonEtlService python, JdbcTemplate jdbc, ObjectMapper json) {
        this.validacao = validacao;
        this.props = props;
        this.python = python;
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * Recebe as linhas que o Pinia validou no navegador.
     * Mesmo assim o Spring confere tudo de novo: nunca se confia apenas no navegador.
     */
    public Map<String, Object> receberValidadas(EnvioValidadasRequest req) {
        if (req == null || req.linhas() == null || req.linhas().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não há linhas validadas para enviar.");
        }
        int maxLinhas = props.upload() == null || props.upload().maxLinhas() <= 0
                ? 5000 : props.upload().maxLinhas();
        if (req.linhas().size() > maxLinhas) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "A planilha passou do limite de " + maxLinhas + " linhas.");
        }
        String nome = nomeSeguro(req.arquivoNome());
        int descartadas = req.descartadas() == null ? 0 : Math.max(0, req.descartadas());

        return registrar(nome, req.linhas(), descartadas);
    }

    /** Valida de novo e ENCAMINHA as linhas válidas ao Python. */
    private Map<String, Object> registrar(String nome, List<LinhaEnvio> brutas, int descartadas) {
        List<ResultadoLinha> resultado = validacao.validar(brutas);

        List<Map<String, Object>> validas = new ArrayList<>();
        List<String> rejeitadas = new ArrayList<>();
        int comAviso = 0;
        for (ResultadoLinha r : resultado) {
            if (!r.valida()) {
                rejeitadas.add("Linha " + r.numero() + ": " + String.join(" | ", r.erros()));
                continue;
            }
            if (!r.avisos().isEmpty()) comAviso++;
            validas.add(paraPython(r));
        }
        if (validas.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Nenhuma linha válida. Corrija a planilha e envie novamente.");
        }

        int recebidas = resultado.size() + descartadas;
        int invalidas = rejeitadas.size() + descartadas;
        Map<String, Object> respPython = python.enviar(nome, recebidas, invalidas, comAviso, validas);

        Map<String, Object> saida = new LinkedHashMap<>();
        if (respPython.containsKey("loteId")) {
            saida.put("loteId", respPython.get("loteId"));
        }
        saida.put("arquivoNome", nome);
        saida.put("status", "PROCESSADO");
        saida.put("totalLinhas", recebidas);
        saida.put("linhasValidas", validas.size());
        saida.put("linhasInvalidas", invalidas);
        saida.put("linhasComAviso", comAviso);
        saida.put("rejeitadas", rejeitadas);
        if (respPython.containsKey("estatisticas")) {
            saida.put("estatisticas", respPython.get("estatisticas"));
        }
        return saida;
    }

    /** Lista os últimos lotes processados no banco. */
    public List<Map<String, Object>> listarLotes() {
        String sql = """
            SELECT id, arquivo_nome, enviado_em, status, total_linhas,
                   linhas_validas, linhas_invalidas, linhas_com_aviso, mensagem
            FROM upload_lote
            ORDER BY enviado_em DESC, id DESC
            LIMIT 20
        """;
        return jdbc.query(sql, (rs, rowNum) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getLong("id"));
            m.put("arquivoNome", rs.getString("arquivo_nome"));
            LocalDateTime env = rs.getObject("enviado_em", LocalDateTime.class);
            m.put("enviadoEm", env != null ? env.toInstant(ZoneOffset.UTC).toString() : null);
            m.put("status", rs.getString("status"));
            m.put("totalLinhas", rs.getInt("total_linhas"));
            m.put("linhasValidas", rs.getInt("linhas_validas"));
            m.put("linhasInvalidas", rs.getInt("linhas_invalidas"));
            m.put("linhasComAviso", rs.getInt("linhas_com_aviso"));
            m.put("mensagem", rs.getString("mensagem"));
            return m;
        });
    }

    /** Devolve o último lote PROCESSADO e suas estatísticas calculadas pelo Python (ou um lote específico por ID). */
    public Map<String, Object> buscarEstatisticaLote(Long loteId) {
        String sql = loteId == null ? """
            SELECT u.id, u.arquivo_nome, u.enviado_em, u.status, u.total_linhas,
                   u.linhas_validas, u.linhas_invalidas, u.linhas_com_aviso, u.mensagem,
                   e.resultado
            FROM upload_lote u
            JOIN estatistica_lote e ON e.lote_id = u.id
            WHERE u.status = 'PROCESSADO'
            ORDER BY u.enviado_em DESC, u.id DESC
            LIMIT 1
        """ : """
            SELECT u.id, u.arquivo_nome, u.enviado_em, u.status, u.total_linhas,
                   u.linhas_validas, u.linhas_invalidas, u.linhas_com_aviso, u.mensagem,
                   e.resultado
            FROM upload_lote u
            LEFT JOIN estatistica_lote e ON e.lote_id = u.id
            WHERE u.id = ?
        """;
        List<Map<String, Object>> rows = jdbc.query(
                sql,
                ps -> {
                    if (loteId != null) ps.setLong(1, loteId);
                },
                (rs, rowNum) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("loteId", rs.getLong("id"));
                    m.put("arquivoNome", rs.getString("arquivo_nome"));
                    LocalDateTime env = rs.getObject("enviado_em", LocalDateTime.class);
                    m.put("enviadoEm", env != null ? env.toInstant(ZoneOffset.UTC).toString() : null);
                    m.put("status", rs.getString("status"));
                    m.put("totalLinhas", rs.getInt("total_linhas"));
                    m.put("linhasValidas", rs.getInt("linhas_validas"));
                    m.put("linhasInvalidas", rs.getInt("linhas_invalidas"));
                    m.put("linhasComAviso", rs.getInt("linhas_com_aviso"));
                    m.put("mensagem", rs.getString("mensagem"));
                    String resultadoStr = rs.getString("resultado");
                    if (resultadoStr != null && !resultadoStr.isBlank()) {
                        m.put("estatisticas", json.readValue(resultadoStr, new TypeReference<Map<String, Object>>() {}));
                    }
                    return m;
                });
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Nenhum lote processado encontrado.");
        }
        return rows.get(0);
    }

    /** Remove um lote e todos os dados vinculados (clientes, contratos e estatísticas via CASCADE). */
    public void removerLote(Long loteId) {
        int removidos = jdbc.update("DELETE FROM upload_lote WHERE id = ?", loteId);
        if (removidos == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Planilha não encontrada.");
        }
    }

    private Map<String, Object> paraPython(ResultadoLinha r) {
        Map<String, String> v = r.valores();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("linha", r.numero());
        m.put("codigo_cliente", vazioParaNulo(v.get(CODIGO)));
        m.put("nome_cliente", vazioParaNulo(v.get(NOME)));
        m.put("consultor", vazioParaNulo(v.get(CONSULTOR)));
        m.put("segmento", vazioParaNulo(v.get(SEGMENTO)));
        m.put("nivel_cliente", vazioParaNulo(v.get(NIVEL)));
        m.put("faturamento_anual", vazioParaNulo(v.get(FATURAMENTO)));
        m.put("servicos_contratados", vazioParaNulo(v.get(SERVICOS)));
        m.put("data_contratacao", vazioParaNulo(v.get(DATA)));
        m.put("cidade", vazioParaNulo(v.get(CIDADE)));
        m.put("uf", vazioParaNulo(v.get(UF)));
        return m;
    }

    private static String vazioParaNulo(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private static String nomeSeguro(String original) {
        String nome = original == null ? "planilha" : original.replace('\\', '/');
        nome = nome.substring(nome.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").strip();
        if (nome.isEmpty()) nome = "planilha";
        return nome.length() > 255 ? nome.substring(nome.length() - 255) : nome;
    }
}
