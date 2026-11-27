package com.senai.backend_java.services;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.senai.backend_java.config.ApiException;
import com.senai.backend_java.dto.AtualizarPerfilRequest;
import com.senai.backend_java.dto.CadastroRequest;
import com.senai.backend_java.dto.LoginRequest;
import com.senai.backend_java.dto.LoginResponse;
import com.senai.backend_java.dto.RedefinirSenhaRequest;
import com.senai.backend_java.dto.UsuarioResponse;
import com.senai.backend_java.models.Profile;
import com.senai.backend_java.models.StatusUsuario;
import com.senai.backend_java.models.TokenRecuperacaoSenha;
import com.senai.backend_java.models.Usuario;
import com.senai.backend_java.repositories.TokenRecuperacaoSenhaRepository;
import com.senai.backend_java.repositories.UsuarioRepository;
import com.senai.backend_java.security.JwtService;

/**
 * Serviço responsável pelo cadastro de novos usuários e pela autenticação com JWT.
 */
@Service
public class AuthService {
  private static final Logger log = LoggerFactory.getLogger(AuthService.class);
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final int EXPIRACAO_CODIGO_MINUTOS = 15;

  private final UsuarioRepository repository;
  private final TokenRecuperacaoSenhaRepository tokenRepository;
  private final PasswordEncoder encoder;
  private final JwtService jwt;
  private final boolean exporCodigoRecuperacao;

  public AuthService(
      UsuarioRepository repository,
      TokenRecuperacaoSenhaRepository tokenRepository,
      PasswordEncoder encoder,
      JwtService jwt,
      @Value("${app.auth.expor-codigo-recuperacao:false}") boolean exporCodigoRecuperacao) {
    this.repository = repository;
    this.tokenRepository = tokenRepository;
    this.encoder = encoder;
    this.jwt = jwt;
    this.exporCodigoRecuperacao = exporCodigoRecuperacao;
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

  /**
   * Atualiza nome e e-mail do usuário autenticado e emite um novo token JWT
   * (necessário caso o e-mail seja alterado, pois ele é o subject do token).
   *
   * @throws ApiException 401 se o usuário da sessão não existir; 409 se o novo e-mail já estiver em uso
   */
  public LoginResponse atualizarPerfil(String emailAtual, AtualizarPerfilRequest dados) {
    Usuario user = repository.findByEmailIgnoreCase(emailAtual)
        .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sessão inválida. Entre novamente."));

    String novoNome = dados.nome().trim();
    String novoEmail = dados.email().trim().toLowerCase(Locale.ROOT);

    if (!novoEmail.equalsIgnoreCase(user.getEmail()) && repository.existsByEmailIgnoreCase(novoEmail)) {
      throw new ApiException(HttpStatus.CONFLICT, "Este e-mail já está cadastrado em outra conta.");
    }

    user.setNome(novoNome);
    user.setEmail(novoEmail);
    Usuario salvo = repository.save(user);

    return new LoginResponse(jwt.gerar(salvo), "Bearer", UsuarioResponse.de(salvo));
  }

  /**
   * Gera um código numérico temporário (15 min) para redefinição de senha.
   * Nunca revela se o e-mail existe na base para evitar enumeração de contas.
   */
  @Transactional
  public Map<String, Object> solicitarRecuperacao(String emailInformado) {
    String email = emailInformado.trim().toLowerCase(Locale.ROOT);
    Map<String, Object> resposta = new LinkedHashMap<>();
    resposta.put("mensagem", "Se o e-mail estiver cadastrado, enviamos um código de verificação válido por 15 minutos.");

    Usuario user = repository.findByEmailIgnoreCase(email).orElse(null);
    if (user == null) {
      return resposta;
    }

    // Invalida códigos anteriores ainda não utilizados
    List<TokenRecuperacaoSenha> pendentes = tokenRepository.findByUsuarioIdAndUsadoFalse(user.getId());
    for (TokenRecuperacaoSenha antigo : pendentes) {
      antigo.setUsado(true);
    }
    if (!pendentes.isEmpty()) {
      tokenRepository.saveAll(pendentes);
    }

    String codigo = String.format("%06d", RANDOM.nextInt(1_000_000));
    TokenRecuperacaoSenha novoToken = new TokenRecuperacaoSenha();
    novoToken.setUsuario(user);
    novoToken.setCodigoHash(encoder.encode(codigo));
    novoToken.setExpiraEm(LocalDateTime.now().plusMinutes(EXPIRACAO_CODIGO_MINUTOS));
    novoToken.setUsado(false);
    tokenRepository.save(novoToken);

    log.info("Código de recuperação gerado para {}: {} (expira em {} min)", email, codigo, EXPIRACAO_CODIGO_MINUTOS);
    if (exporCodigoRecuperacao) {
      resposta.put("codigoTeste", codigo);
    }
    return resposta;
  }

  /**
   * Valida o código temporário e atualiza a senha do usuário.
   */
  @Transactional
  public Map<String, String> redefinirSenha(RedefinirSenhaRequest dados) {
    String email = dados.email().trim().toLowerCase(Locale.ROOT);
    if (dados.novaSenha().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Senha muito longa. Use no máximo 72 bytes.");
    }

    Usuario user = repository.findByEmailIgnoreCase(email)
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Código inválido ou expirado."));

    TokenRecuperacaoSenha token = tokenRepository
        .findTopByUsuarioIdAndUsadoFalseOrderByCriadoEmDesc(user.getId())
        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Código inválido ou expirado."));

    if (token.getExpiraEm().isBefore(LocalDateTime.now()) || !encoder.matches(dados.codigo().trim(), token.getCodigoHash())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Código inválido ou expirado.");
    }

    user.setSenhaHash(encoder.encode(dados.novaSenha()));
    repository.save(user);

    token.setUsado(true);
    tokenRepository.save(token);

    return Map.of("mensagem", "Senha redefinida com sucesso! Você já pode entrar com a nova senha.");
  }
}
