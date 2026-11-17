package com.senai.backend_java.services;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.senai.backend_java.config.ApiException;
import com.senai.backend_java.dto.CadastroRequest;
import com.senai.backend_java.dto.LoginRequest;
import com.senai.backend_java.dto.LoginResponse;
import com.senai.backend_java.dto.UsuarioResponse;
import com.senai.backend_java.models.Profile;
import com.senai.backend_java.models.StatusUsuario;
import com.senai.backend_java.models.Usuario;
import com.senai.backend_java.repositories.UsuarioRepository;
import com.senai.backend_java.security.JwtService;

/**
 * Serviço responsável pelo cadastro de novos usuários e pela autenticação com JWT.
 */
@Service
public class AuthService {
  private final UsuarioRepository repository;
  private final PasswordEncoder encoder;
  private final JwtService jwt;

  public AuthService(UsuarioRepository repository, PasswordEncoder encoder, JwtService jwt) {
    this.repository = repository;
    this.encoder = encoder;
    this.jwt = jwt;
  }

  /**
   * Cria um usuário com status APROVADO para permitir login imediato após o cadastro.
   *
   * @throws ApiException 400 se a senha passar de 72 bytes; 409 se o e-mail já existir
   */
  public UsuarioResponse cadastrar(CadastroRequest dados) {
    String email = dados.email().trim().toLowerCase(Locale.ROOT);

    if (dados.senha().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Senha muito longa. Use no máximo 72 bytes.");
    }
    if (repository.existsByEmailIgnoreCase(email)) {
      throw new ApiException(HttpStatus.CONFLICT, "E-mail já cadastrado.");
    }
    Usuario user = new Usuario();
    user.setNome(dados.nome().trim());
    user.setEmail(email);
    user.setSenhaHash(encoder.encode(dados.senha()));
    user.setPerfil(Profile.USER);
    user.setStatus(StatusUsuario.APROVADO);
    return UsuarioResponse.de(repository.save(user));
  }

  /**
   * Confere e-mail/senha e devolve um token JWT.
   *
   * @throws ApiException 401 se e-mail ou senha estiverem errados; 403 se o acesso não estiver aprovado
   */
  public LoginResponse entrar(LoginRequest dados) {
    Usuario user = repository.findByEmailIgnoreCase(dados.email().trim()).orElse(null);

    if (user == null || !encoder.matches(dados.senha(), user.getSenhaHash())) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "E-mail ou senha incorretos.");
    }

    if (user.getStatus() == StatusUsuario.PENDENTE) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Seu cadastro ainda aguarda aprovação do administrador.");
    }
    if (user.getStatus() != StatusUsuario.APROVADO) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Seu acesso está bloqueado. Procure o administrador.");
    }

    return new LoginResponse(jwt.gerar(user), "Bearer", UsuarioResponse.de(user));
  }
}
