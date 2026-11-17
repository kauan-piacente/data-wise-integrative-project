package com.senai.backend_java.controllers;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.senai.backend_java.dto.UploadDTO.EnvioValidadasRequest;
import com.senai.backend_java.services.UploadService;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {
  private final UploadService service;

  public UploadController(UploadService service) {
    this.service = service;
  }

  @PostMapping("/validadas")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> enviarValidadas(@RequestBody EnvioValidadasRequest pedido) {
    return service.receberValidadas(pedido);
  }

  @GetMapping("/lotes")
  public List<Map<String, Object>> listarLotes() {
    return service.listarLotes();
  }

  @GetMapping("/ultimo")
  public Map<String, Object> buscarUltimo() {
    return service.buscarEstatisticaLote(null);
  }

  @GetMapping("/{id}")
  public Map<String, Object> buscarPorId(@PathVariable Long id) {
    return service.buscarEstatisticaLote(id);
  }
}
