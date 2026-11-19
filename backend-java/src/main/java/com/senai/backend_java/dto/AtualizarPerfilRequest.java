package com.senai.backend_java.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AtualizarPerfilRequest(
    @NotBlank(message = "Informe o nome.")
    @Size(max = 120, message = "Nome deve ter no máximo 120 caracteres.")
    String nome,

    @NotBlank(message = "Informe o e-mail.")
    @Email(message = "Informe um e-mail válido.")
    @Size(max = 160, message = "E-mail deve ter no máximo 160 caracteres.")
    String email
) {}
