package com.senai.backend_java.repositories;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.senai.backend_java.models.TokenRecuperacaoSenha;

public interface TokenRecuperacaoSenhaRepository extends JpaRepository<TokenRecuperacaoSenha, Long> {
    Optional<TokenRecuperacaoSenha> findTopByUsuarioIdAndUsadoFalseOrderByCriadoEmDesc(Long usuarioId);
    List<TokenRecuperacaoSenha> findByUsuarioIdAndUsadoFalse(Long usuarioId);
}
