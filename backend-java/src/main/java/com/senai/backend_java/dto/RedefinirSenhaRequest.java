package com.senai.backend_java.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RedefinirSenhaRequest(
    @NotBlank(message = "Informe o e-mail.")
    @Email(message = "Informe um e-mail válido.")
    @Size(max = 160)
    String email,

    @NotBlank(message = "Informe o código de verificação.")
    @Pattern(regexp = "^\\d{6}$", message = "O código deve conter 6 dígitos numéricos.")
    String codigo,

    @NotBlank(message = "Informe a nova senha.")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$", message = "Use de 8 a 72 caracteres com letras e números")
    String novaSenha
) {}
