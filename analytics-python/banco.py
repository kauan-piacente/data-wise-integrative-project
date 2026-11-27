"""Camada de persistência: gerencia a conexão com o PostgreSQL, cria lotes e grava os resultados do ETL."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from config import database_url

log = logging.getLogger("analytics")
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"


def criar_engine(garantir_banco: bool = True) -> Engine:
    """Abre a conexão com o PostgreSQL e garante que o banco e as tabelas existam."""
    url = database_url()
    engine = create_engine(url, pool_pre_ping=True)
    if garantir_banco:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except OperationalError as exc:
            alvo = url.database or "data-wize"
            # Caso o banco ainda não exista no servidor PostgreSQL, cria automaticamente
            if f'database "{alvo}" does not exist' in str(exc):
                log.info("Database '%s' não encontrado; criando no servidor...", alvo)
                url_admin = url.set(database="postgres")
                eng_admin = create_engine(url_admin, isolation_level="AUTOCOMMIT")
                try:
                    with eng_admin.connect() as conn_admin:
                        nome_seguro = alvo.replace('"', '""')
                        conn_admin.execute(text(f'CREATE DATABASE "{nome_seguro}"'))
                        log.info("Database '%s' criado com sucesso.", alvo)
                finally:
                    eng_admin.dispose()
            else:
                raise
        garantir_schema(engine)
    return engine


def garantir_schema(engine: Engine) -> None:
    """Executa o arquivo database/schema.sql para garantir que todas as tabelas estejam criadas."""
    if not SCHEMA_PATH.exists():
        return
    sql_script = SCHEMA_PATH.read_text(encoding="utf-8")
    if not sql_script.strip() or "CREATE TABLE" not in sql_script.upper():
        return
    with engine.begin() as conn:
        tem_cliente = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'cliente')"
        )).scalar()
        if tem_cliente:
            tem_lote_id = conn.execute(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = 'cliente' AND column_name = 'lote_id')"
            )).scalar()
            if not tem_lote_id:
                log.warning("Estrutura antiga detectada na tabela 'cliente'. Atualizando tabelas do ETL...")
                for tabela in ("insight", "telemetria", "contrato", "cliente", "servico", "segmento", "consultor", "estatistica_lote", "upload_lote"):
                    conn.execute(text(f"DROP TABLE IF EXISTS {tabela} CASCADE"))

        for comando in sql_script.split(";"):
            cmd = comando.strip()
            if cmd:
                conn.execute(text(cmd))


def agora_utc() -> datetime:
    """Retorna a data e hora atual em UTC sem fuso horário, no mesmo formato usado pelo backend Java."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def criar_lote(engine: Engine, arquivo_nome: str, recebidas: int,
               invalidas: int, validas: int, com_aviso: int) -> int:
    """Registra o início do processamento na tabela upload_lote e devolve o ID gerado."""
    with engine.begin() as conn:
        return int(conn.execute(
            text("INSERT INTO upload_lote (arquivo_nome, enviado_em, status, total_linhas, "
                 "linhas_validas, linhas_invalidas, linhas_com_aviso, mensagem) "
                 "VALUES (:a, :e, 'PROCESSANDO', :t, :v, :i, :c, 'ETL em andamento...') RETURNING id"),
            {"a": arquivo_nome[:255], "e": agora_utc(), "t": recebidas,
             "v": validas, "i": invalidas, "c": com_aviso}).scalar_one())


def marcar_erro(engine: Engine, lote_id: int, mensagem: str) -> None:
    """Atualiza o status do lote para ERRO e registra o motivo da falha."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE upload_lote SET status = 'ERRO', mensagem = :m WHERE id = :id"),
                     {"id": lote_id, "m": mensagem[:480]})


def gravar_resultado(engine: Engine, lote_id: int, tratado: pd.DataFrame, payload: dict, rejeitadas_etl: int) -> None:
    """Salva clientes, contratos e estatísticas do lote dentro de uma única transação."""
    with engine.begin() as conn:
        # Remove dados anteriores caso o mesmo lote seja reprocessado
        conn.execute(text("DELETE FROM cliente WHERE lote_id = :l"), {"l": lote_id})
        conn.execute(text("DELETE FROM estatistica_lote WHERE lote_id = :l"), {"l": lote_id})

        consultores: dict[str, int] = {}
        segmentos: dict[str, int] = {}
        servicos: dict[str, int] = {}

        def id_de(tabela: str, nome: str, cache: dict[str, int]) -> int:
            """Busca ou insere um registro nas tabelas auxiliares (consultor, segmento ou servico)."""
            if nome not in cache:
                conn.execute(text(f"INSERT INTO {tabela} (nome) VALUES (:n) ON CONFLICT (nome) DO NOTHING"), {"n": nome})
                cache[nome] = int(conn.execute(text(f"SELECT id FROM {tabela} WHERE nome = :n"), {"n": nome}).scalar_one())
            return cache[nome]

        for r in tratado.itertuples(index=False):
            cliente_id = int(conn.execute(text("""
                INSERT INTO cliente (lote_id, codigo_cti, nome, consultor_id, segmento_id, nivel, faturamento_anual, cidade, uf)
                VALUES (:lote, :codigo, :nome, :consultor, :segmento, :nivel, :fat, :cidade, :uf)
                RETURNING id
            """), {
                "lote": lote_id, "codigo": r.codigo_cliente[:60], "nome": r.nome_cliente[:255],
                "consultor": id_de("consultor", r.consultor[:120], consultores),
                "segmento": id_de("segmento", r.segmento[:40], segmentos),
                "nivel": r.nivel_cliente, "fat": round(float(r.faturamento_anual), 2),
                "cidade": r.cidade[:120] if isinstance(r.cidade, str) else None,
                "uf": r.uf if isinstance(r.uf, str) else None,
            }).scalar_one())

            for nome_servico in r.servicos:
                conn.execute(text("""
                    INSERT INTO contrato (cliente_id, servico_id, data_contratacao)
                    VALUES (:c, :s, :d)
                    ON CONFLICT (cliente_id, servico_id) DO NOTHING
                """), {"c": cliente_id, "s": id_de("servico", nome_servico[:120], servicos),
                       "d": r.data_contratacao.date()})

        conn.execute(text("INSERT INTO estatistica_lote (lote_id, gerado_em, resultado) VALUES (:l, :g, :r)"),
                     {"l": lote_id, "g": agora_utc(), "r": json.dumps(payload, ensure_ascii=False)})

        mensagem = f"Importação concluída: {len(tratado)} clientes analisados"
        if rejeitadas_etl:
            mensagem += f", {rejeitadas_etl} linhas ignoradas por inconsistência"
        conn.execute(text("UPDATE upload_lote SET status = 'PROCESSADO', mensagem = :m WHERE id = :id"),
                     {"id": lote_id, "m": mensagem + "."})
    log.info("Lote %s gravado: %s clientes, %s consultores, %s segmentos, %s serviços",
             lote_id, len(tratado), len(consultores), len(segmentos), len(servicos))


def listar_lotes(engine: Engine, limite: int = 20) -> list[dict]:
    """Retorna os lotes mais recentes registrados no banco de dados."""
    with engine.connect() as conn:
        linhas = conn.execute(text("""
            SELECT id, arquivo_nome, enviado_em, status, total_linhas,
                   linhas_validas, linhas_invalidas, linhas_com_aviso, mensagem
            FROM upload_lote
            ORDER BY enviado_em DESC, id DESC
            LIMIT :lim
        """), {"lim": limite}).mappings().all()
        return [
            {
                "id": int(r["id"]),
                "arquivoNome": r["arquivo_nome"],
                "enviadoEm": r["enviado_em"].replace(tzinfo=timezone.utc).isoformat() if r["enviado_em"] else None,
                "status": r["status"],
                "totalLinhas": int(r["total_linhas"]),
                "linhasValidas": int(r["linhas_validas"]),
                "linhasInvalidas": int(r["linhas_invalidas"]),
                "linhasComAviso": int(r["linhas_com_aviso"]),
                "mensagem": r["mensagem"],
            }
            for r in linhas
        ]


def buscar_estatistica_lote(engine: Engine, lote_id: int | None = None) -> dict | None:
    """Busca os dados e as estatísticas de um lote específico ou do último lote concluído."""
    with engine.connect() as conn:
        if lote_id is None:
            row = conn.execute(text("""
                SELECT u.id, u.arquivo_nome, u.enviado_em, u.status, u.total_linhas,
                       u.linhas_validas, u.linhas_invalidas, u.linhas_com_aviso, u.mensagem,
                       e.gerado_em, e.resultado
                FROM upload_lote u
                JOIN estatistica_lote e ON e.lote_id = u.id
                WHERE u.status = 'PROCESSADO'
                ORDER BY u.enviado_em DESC, u.id DESC
                LIMIT 1
            """)).mappings().first()
        else:
            row = conn.execute(text("""
                SELECT u.id, u.arquivo_nome, u.enviado_em, u.status, u.total_linhas,
                       u.linhas_validas, u.linhas_invalidas, u.linhas_com_aviso, u.mensagem,
                       e.gerado_em, e.resultado
                FROM upload_lote u
                LEFT JOIN estatistica_lote e ON e.lote_id = u.id
                WHERE u.id = :id
            """), {"id": lote_id}).mappings().first()
        if not row:
            return None
        estatisticas = json.loads(row["resultado"]) if row["resultado"] else None
        return {
            "loteId": int(row["id"]),
            "arquivoNome": row["arquivo_nome"],
            "enviadoEm": row["enviado_em"].replace(tzinfo=timezone.utc).isoformat() if row["enviado_em"] else None,
            "status": row["status"],
            "totalLinhas": int(row["total_linhas"]),
            "linhasValidas": int(row["linhas_validas"]),
            "linhasInvalidas": int(row["linhas_invalidas"]),
            "linhasComAviso": int(row["linhas_com_aviso"]),
            "mensagem": row["mensagem"],
            "estatisticas": estatisticas,
        }


def excluir_lote(engine: Engine, lote_id: int) -> bool:
    """Remove um lote e todos os registros vinculados (clientes, contratos e estatísticas)."""
    with engine.begin() as conn:
        res = conn.execute(text("DELETE FROM upload_lote WHERE id = :id"), {"id": lote_id})
        return res.rowcount > 0
