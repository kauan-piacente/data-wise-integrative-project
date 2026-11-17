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
@Table(name = "consultor")
public class Consultor {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  private Long idConsultor;

  @Column(name = "nome", nullable = false, length = 120, unique = true)
  private String nome;

  @Column(name = "email", length = 150, unique = true)
  private String email;

  @Column(name = "senha")
  private String senha;

  @Column(name = "telefone", length = 30)
  private String telefone;

  @OneToMany(mappedBy = "consultor")
  private List<Cliente> clientes = new ArrayList<>();

  public Consultor() {
  }

  public Consultor(Long idConsultor, String nome, String email, String telefone, String senha) {
    this.idConsultor = idConsultor;
    this.nome = nome;
    this.email = email;
    this.telefone = telefone;
    this.senha = senha;
  }

  public Long getIdConsultor() {
    return idConsultor;
  }

  public void setIdConsultor(Long idConsultor) {
    this.idConsultor = idConsultor;
  }

  public String getNome() {
    return nome;
  }

  public void setNome(String nome) {
    this.nome = nome;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getTelefone() {
    return telefone;
  }

  public void setTelefone(String telefone) {
    this.telefone = telefone;
  }

  public List<Cliente> getClientes() {
    return clientes;
  }

  public void setClientes(List<Cliente> clientes) {
    this.clientes = clientes;
  }

  public String getSenha() {
    return senha;
  }

  public void setSenha(String senha) {
    this.senha = senha;
  }
}
