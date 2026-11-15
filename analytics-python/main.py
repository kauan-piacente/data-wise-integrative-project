"""Orquestrador principal do ETL em Python.

Pode ser chamado pela API FastAPI (função processar_lote) ou executado diretamente pelo terminal:
    python main.py                  # processa amostras/clientes.json e exibe o resumo no terminal
    python main.py --gravar         # processa e grava o lote no banco PostgreSQL
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from analise import calcular
from insights import brl
from limpeza import tratar

log = logging.getLogger("analytics")


def processar_lote(engine, arquivo_nome: str, linhas: list[dict],
                   recebidas: int, invalidas: int, com_aviso: int) -> tuple[int, dict]:
    """Cria o registro do lote, executa a limpeza e a análise estatística e persiste o resultado no banco."""
    import banco
    if not linhas:
        raise ValueError("O backend não enviou linhas válidas.")
    lote_id = banco.criar_lote(engine, arquivo_nome, recebidas, invalidas, len(linhas), com_aviso)
    try:
        bruto = pd.DataFrame(linhas).astype(object)
        res = tratar(bruto)
        payload = calcular(res, recebidas)
        banco.gravar_resultado(engine, lote_id, res.tratado, payload, len(res.rejeitadas))
        log.info("Lote %s processado.", lote_id)
        return lote_id, payload
    except Exception as e:  # noqa: BLE001
        log.exception("Falha no lote %s", lote_id)
        banco.marcar_erro(engine, lote_id, f"Falha no ETL: {e}")
        raise


def _carregar_arquivo(caminho: Path) -> list[dict]:
    """Lê arquivos JSON, CSV ou Excel e devolve uma lista de dicionários para execução via terminal."""
    sufixo = caminho.suffix.lower()
    if sufixo == ".json":
        return json.loads(caminho.read_text(encoding="utf-8"))
    if sufixo == ".csv":
        return pd.read_csv(caminho, dtype=str).where(lambda d: d.notna(), None).to_dict(orient="records")
    if sufixo in (".xlsx", ".xls"):
        return pd.read_excel(caminho, dtype=str).where(lambda d: d.notna(), None).to_dict(orient="records")
    raise ValueError(f"Formato não suportado: {sufixo} (use .json, .csv ou .xlsx)")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    padrao = Path(__file__).resolve().parent / "amostras" / "clientes.json"
    parser = argparse.ArgumentParser(description="Executa o pipeline ETL de clientes CTI Insights.")
    parser.add_argument("arquivo", nargs="?", default=str(padrao), help="Caminho para JSON, CSV ou XLSX (padrão: amostras/clientes.json)")
    parser.add_argument("--gravar", action="store_true", help="Grava o resultado no banco PostgreSQL configurado no .env")
    args = parser.parse_args()

    caminho = Path(args.arquivo)
    linhas = _carregar_arquivo(caminho)
    bruto = pd.DataFrame(linhas).astype(object)
    res = tratar(bruto)
    payload = calcular(res, len(linhas))

    r = payload["resumo"]
    print("=" * 72)
    print(f"Arquivo analisado : {caminho.name}")
    print(f"Linhas recebidas  : {len(linhas)} | Válidas: {len(res.tratado)} | Recusadas: {len(res.rejeitadas)}")
    print(f"Faturamento total : {brl(r['faturamentoTotal'])} | Média: {brl(r['media'])} | Mediana: {brl(r['mediana'])}")
    print(f"Segmento principal: {r['segmentoMaisFrequente']} | Serviço mais contratado: {r['servicoMaisContratado']}")
    print("-" * 72)
    print("Insights gerados:")
    for frase in payload["insights"]:
        print(f"  • {frase}")
    if not res.rejeitadas.empty:
        print("-" * 72)
        print("Linhas recusadas na limpeza:")
        for rej in res.rejeitadas.itertuples():
            print(f"  • Linha {rej.linha} ({rej.codigo_cliente}): {rej.motivo}")
    print("=" * 72)

    if args.gravar:
        import banco
        engine = banco.criar_engine()
        lote_id, _ = processar_lote(engine, caminho.name, linhas, len(linhas), len(res.rejeitadas), sum(res.padronizacoes.values()))
        print(f"Gravado com sucesso no banco! Lote ID = {lote_id}")
