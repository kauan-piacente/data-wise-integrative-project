package com.senai.backend_java.models;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "contrato")
public class Contrato {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  private Long idContrato;

  @ManyToOne
  @JoinColumn(name = "cliente_id")
  private Cliente cliente;

  @ManyToOne
  @JoinColumn(name = "servico_id")
  private Servico servico;

  @Column(name = "data_contratacao", nullable = false)
  private LocalDate dataInicio;

  @Column(name = "valor", precision = 15, scale = 2)
  private BigDecimal valor;

  @Column(name = "data_fim")
  private LocalDate dataFim;

  @Enumerated(EnumType.STRING)
  @Column(name = "status")
  private StatusContrato status = StatusContrato.ATIVO;

  public Contrato() {
  }

  public Contrato(Long idContrato, Cliente cliente, Servico servico, LocalDate dataInicio, LocalDate dataFim,
      StatusContrato status) {
    this.idContrato = idContrato;
    this.cliente = cliente;
    this.servico = servico;
    this.dataInicio = dataInicio;
    this.dataFim = dataFim;
    this.status = status;
  }

  public Long getIdContrato() {
    return idContrato;
  }

  public void setIdContrato(Long idContrato) {
    this.idContrato = idContrato;
  }

  public Cliente getCliente() {
    return cliente;
  }

  public void setCliente(Cliente cliente) {
    this.cliente = cliente;
  }

  public Servico getServico() {
    return servico;
  }

  public void setServico(Servico servico) {
    this.servico = servico;
  }

  public LocalDate getDataInicio() {
    return dataInicio;
  }

  public void setDataInicio(LocalDate dataInicio) {
    this.dataInicio = dataInicio;
  }

  public LocalDate getDataFim() {
    return dataFim;
  }

  public void setDataFim(LocalDate dataFim) {
    this.dataFim = dataFim;
  }

  public StatusContrato getStatus() {
    return status;
  }

  public void setStatus(StatusContrato status) {
    this.status = status;
  }

  public BigDecimal getValor() {
    return valor;
  }

  public void setValor(BigDecimal valor) {
    this.valor = valor;
  }
}
