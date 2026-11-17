package com.senai.backend_java.services;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Funções utilitárias para padronizar nomes de segmentos empresariais e nomes próprios.
 */
public final class Padronizacao {
  private Padronizacao() {}

  private static final Map<String, String> SEGMENTOS = Map.ofEntries(
          Map.entry("ind", "Indústria"), Map.entry("industria", "Indústria"), Map.entry("industrial", "Indústria"),
          Map.entry("com", "Comércio"), Map.entry("comercio", "Comércio"), Map.entry("comercial", "Comércio"),
          Map.entry("serv", "Serviços"), Map.entry("servicos", "Serviços"), Map.entry("servico", "Serviços"),
          Map.entry("saude", "Saúde"),
          Map.entry("edu", "Educação"), Map.entry("educacao", "Educação"),
          Map.entry("tec", "Tecnologia"), Map.entry("ti", "Tecnologia"), Map.entry("tecnologia", "Tecnologia"));

  private static final Set<String> PARTICULAS = Set.of("de", "da", "do", "das", "dos", "e");

  /** Remove acentos, converte para minúsculas e elimina pontuação para comparação uniforme. */
  static String simples(String texto) {
      String semAcento = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
      return semAcento.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
  }

  /** Retorna o nome oficial do segmento ou null caso o valor não seja reconhecido. */
  public static String segmento(String texto) {
      return SEGMENTOS.get(simples(texto));
  }

  /** Formata nomes próprios com iniciais maiúsculas, mantendo preposições em minúsculo. */
  public static String tituloNome(String texto) {
      String[] palavras = texto.trim().toLowerCase(Locale.ROOT).split("\\s+");
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < palavras.length; i++) {
          String p = palavras[i];
          if (p.isEmpty()) continue;
          if (sb.length() > 0) sb.append(' ');
          if (i > 0 && PARTICULAS.contains(p)) sb.append(p);
          else sb.append(p.substring(0, 1).toUpperCase(Locale.ROOT)).append(p.substring(1));
      }
      return sb.toString();
  }
}
