package com.senai.backend_java.services;

import java.text.Normalizer;
import java.util.List;
import java.util.Map;

/**
 * Constantes com os nomes das colunas esperadas na planilha de clientes e seus limites de tamanho.
 */
public final class Colunas {
    private Colunas() {}

    public static final String CODIGO = "codigo_cliente";
    public static final String NOME = "nome_cliente";
    public static final String CONSULTOR = "consultor";
    public static final String SEGMENTO = "segmento";
    public static final String NIVEL = "nivel_cliente";
    public static final String FATURAMENTO = "faturamento_anual";
    public static final String SERVICOS = "servicos_contratados";
    public static final String DATA = "data_contratacao";
    public static final String CIDADE = "cidade";
    public static final String UF = "uf";

    public static final List<String> TODAS =
            List.of(CODIGO, NOME, CONSULTOR, SEGMENTO, NIVEL, FATURAMENTO, SERVICOS, DATA, CIDADE, UF);

    /** Colunas de preenchimento obrigatório (apenas cidade e uf são opcionais). */
    public static final List<String> OBRIGATORIAS =
            List.of(CODIGO, NOME, CONSULTOR, SEGMENTO, NIVEL, FATURAMENTO, SERVICOS, DATA);

    public static final Map<String, Integer> TAMANHO_MAXIMO = Map.of(
            CODIGO, 60, NOME, 255, CONSULTOR, 120, SEGMENTO, 80, NIVEL, 20,
            SERVICOS, 400, CIDADE, 120, UF, 10);

    /** Padroniza o texto de um cabeçalho removendo acentos e trocando espaços por sublinhado. */
    public static String normalizarCabecalho(String texto) {
        if (texto == null) return "";
        String semAcento = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return semAcento.trim().toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }
}
