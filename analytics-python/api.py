"""API HTTP em FastAPI para o serviço de ETL em Python.

Recebe as linhas validadas pelo backend Java, executa a limpeza e a análise estatística
e grava os resultados no PostgreSQL.
Como iniciar localmente:
    uvicorn api:app --reload --port 8000
Documentação interativa:
    http://localhost:8000/docs
"""
import logging
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pydantic import BaseModel

import config  # noqa: F401 - carrega as variáveis definidas no .env
from analise import calcular
from limpeza import tratar
from main import processar_lote

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("analytics")
app = FastAPI(title="CTI Insights — ETL em Python", version="1.0.0")

# Libera requisições vindas do navegador durante o desenvolvimento
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine = None


class Pedido(BaseModel):
    """Estrutura do JSON enviado pelo backend ao acionar o endpoint /etl."""
    arquivoNome: str = "planilha"
    recebidas: int
    invalidas: int = 0
    comAviso: int = 0
    linhas: list[dict[str, Any]]


def _engine_azure():
    """Inicializa a conexão com o banco apenas na primeira chamada e reutiliza nas seguintes."""
    global _engine
    if _engine is None:
        import banco
        _engine = banco.criar_engine()
    return _engine


def _validar_chave(x_etl_key: str | None) -> None:
    """Confere o cabeçalho X-ETL-Key quando a variável ETL_API_KEY estiver configurada no .env."""
    chave = os.getenv("ETL_API_KEY", "").strip()
    if chave and x_etl_key != chave:
        raise HTTPException(status_code=401, detail="Chave do ETL inválida.")


@app.get("/saude")
def saude() -> dict:
    """Rota de verificação rápida para confirmar se o serviço Python está no ar."""
    return {"status": "ok"}


@app.post("/etl")
def etl(pedido: Pedido, x_etl_key: str | None = Header(default=None)) -> dict:
    """Recebe o lote de clientes, executa o pipeline ETL completo e grava no banco."""
    _validar_chave(x_etl_key)
    if not pedido.linhas:
        raise HTTPException(status_code=422, detail="Nenhuma linha válida foi enviada.")
    try:
        lote_id, payload = processar_lote(
            _engine_azure(), pedido.arquivoNome, pedido.linhas,
            pedido.recebidas, pedido.invalidas, pedido.comAviso,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Falha no ETL: {e}")
    return {"ok": True, "loteId": lote_id, "estatisticas": payload}


@app.get("/lotes")
def listar_lotes(x_etl_key: str | None = Header(default=None)) -> list[dict]:
    """Lista o histórico dos lotes mais recentes processados no banco."""
    _validar_chave(x_etl_key)
    import banco
    return banco.listar_lotes(_engine_azure())


@app.get("/lotes/ultimo")
def ultimo_lote(x_etl_key: str | None = Header(default=None)) -> dict:
    """Retorna os metadados e as estatísticas completas do último lote concluído."""
    _validar_chave(x_etl_key)
    import banco
    dados = banco.buscar_estatistica_lote(_engine_azure(), None)
    if not dados:
        raise HTTPException(status_code=404, detail="Nenhum lote processado encontrado.")
    return dados


@app.get("/lotes/{lote_id}")
def obter_lote(lote_id: int, x_etl_key: str | None = Header(default=None)) -> dict:
    """Retorna os metadados e as estatísticas de um lote específico pelo seu ID."""
    _validar_chave(x_etl_key)
    import banco
    dados = banco.buscar_estatistica_lote(_engine_azure(), lote_id)
    if not dados:
        raise HTTPException(status_code=404, detail="Lote não encontrado.")
    return dados


@app.post("/testar")
def testar(linhas: list[dict[str, Any]]) -> dict:
    """Executa a limpeza e o cálculo estatístico em memória, sem gravar nada no banco."""
    if not linhas:
        raise HTTPException(status_code=422, detail="Nenhuma linha enviada para teste.")
    res = tratar(pd.DataFrame(linhas).astype(object))
    if res.tratado.empty:
        raise HTTPException(status_code=422, detail="Nenhuma linha válida após limpeza.")
    return calcular(res, len(linhas))
