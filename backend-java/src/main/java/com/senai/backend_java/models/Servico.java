package com.senai.backend_java.models;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "servico")
public class Servico {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  private Long idServico;

  @Column(name = "nome", length = 120, nullable = false, unique = true)
  private String nomeServico;

  @Column(name = "descricao")
  private String descricao;

  @Column(name = "categoria", length = 100)
  private String categoria;

  @OneToMany(mappedBy = "servico")
  private List<Contrato> contratos = new ArrayList<>();

  public Servico() {
  }

  public Servico(Long idServico, String nomeServico, String descricao, String categoria, Contrato contrato) {
    this.idServico = idServico;
    this.nomeServico = nomeServico;
    this.descricao = descricao;
    this.categoria = categoria;
    if (contrato != null) {
      this.contratos.add(contrato);
    }
  }

  public Long getIdServico() {
    return idServico;
  }

  public void setIdServico(Long idServico) {
    this.idServico = idServico;
  }

  public String getNomeServico() {
    return nomeServico;
  }

  public void setNomeServico(String nomeServico) {
    this.nomeServico = nomeServico;
  }

  public String getDescricao() {
    return descricao;
  }

  public void setDescricao(String descricao) {
    this.descricao = descricao;
  }

  public String getCategoria() {
    return categoria;
  }

  public void setCategoria(String categoria) {
    this.categoria = categoria;
  }

  public List<Contrato> getContratos() {
    return contratos;
  }

  public void setContratos(List<Contrato> contratos) {
    this.contratos = contratos;
  }
}
