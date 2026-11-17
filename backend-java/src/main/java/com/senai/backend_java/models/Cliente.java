package com.senai.backend_java.models;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@Entity
@Table(name = "cliente")
public class Cliente {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  private Long idCliente;

  @Column(name = "lote_id")
  private Long loteId;

  @Column(name = "codigo_cti", length = 60)
  private String codigoCti;

  @ManyToOne
  @JoinColumn(name = "consultor_id", nullable = false)
  private Consultor consultor;

  @ManyToOne
  @JoinColumn(name = "segmento_id")
  private Segmento segmentoRef;

  @OneToMany(mappedBy = "cliente")
  private List<Contrato> contratos = new ArrayList<>();

  @Column(name = "nome", nullable = false, length = 255)
  private String nomeEmpresa;

  @Transient
  private String segmento;

  @Column(name = "faturamento_anual", nullable = false, precision = 15, scale = 2)
  private BigDecimal faturamentoAnual;

  @Enumerated(EnumType.STRING)
  @Column(name = "nivel", nullable = false, length = 5)
  private NivelCliente nivel;

  @Column(name = "cidade", length = 120)
  private String cidade;

  @Column(name = "uf", length = 2)
  private String uf;

  @Transient
  private StatusCliente status = StatusCliente.ATIVO;

  public Cliente() {
  }

  public Cliente(Long idCliente, Consultor consultor, String nomeEmpresa, String segmento, BigDecimal faturamentoAnual, NivelCliente nivel, StatusCliente status) {
    this.idCliente = idCliente;
    this.consultor = consultor;
    this.nomeEmpresa = nomeEmpresa;
    this.segmento = segmento;
    this.faturamentoAnual = faturamentoAnual;
    this.nivel = nivel;
    this.status = status;
  }

  public Long getIdCliente() {
    return idCliente;
  }

  public void setIdCliente(Long idCliente) {
    this.idCliente = idCliente;
  }

  public Long getLoteId() {
    return loteId;
  }

  public void setLoteId(Long loteId) {
    this.loteId = loteId;
  }

  public String getCodigoCti() {
    return codigoCti;
  }

  public void setCodigoCti(String codigoCti) {
    this.codigoCti = codigoCti;
  }

  public Consultor getConsultor() {
    return consultor;
  }

  public void setConsultor(Consultor consultor) {
    this.consultor = consultor;
  }

  public Segmento getSegmentoRef() {
    return segmentoRef;
  }

  public void setSegmentoRef(Segmento segmentoRef) {
    this.segmentoRef = segmentoRef;
  }

  public String getNomeEmpresa() {
    return nomeEmpresa;
  }

  public void setNomeEmpresa(String nomeEmpresa) {
    this.nomeEmpresa = nomeEmpresa;
  }

  public String getSegmento() {
    if (segmento != null) return segmento;
    return segmentoRef != null ? segmentoRef.getNome() : null;
  }

  public void setSegmento(String segmento) {
    this.segmento = segmento;
  }

  public BigDecimal getFaturamentoAnual() {
    return faturamentoAnual;
  }

  public void setFaturamentoAnual(BigDecimal faturamentoAnual) {
    this.faturamentoAnual = faturamentoAnual;
  }

  public NivelCliente getNivel() {
    return nivel;
  }

  public void setNivel(NivelCliente nivel) {
    this.nivel = nivel;
  }

  public String getCidade() {
    return cidade;
  }

  public void setCidade(String cidade) {
    this.cidade = cidade;
  }

  public String getUf() {
    return uf;
  }

  public void setUf(String uf) {
    this.uf = uf;
  }

  public StatusCliente getStatus() {
    return status;
  }

  public void setStatus(StatusCliente status) {
    this.status = status;
  }

  public List<Contrato> getContratos() {
    return contratos;
  }

  public void setContratos(List<Contrato> contratos) {
    this.contratos = contratos;
  }
}
