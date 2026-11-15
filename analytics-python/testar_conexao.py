"""Script rápido para testar a conexão com o PostgreSQL e verificar a contagem de lotes.

Como executar:
    python testar_conexao.py
"""
from sqlalchemy import text

from banco import criar_engine

try:
    with criar_engine().connect() as conexao:
        versao = conexao.execute(text("SELECT version()")).scalar()
        print("Conectou!", versao)
        lotes = conexao.execute(text("SELECT COUNT(*) FROM upload_lote")).scalar()
        print("Lotes no banco:", lotes)
except Exception as erro:
    print("Não foi possível conectar. Confira o arquivo .env e as regras de firewall do servidor.")
    print("Detalhe:", str(erro).splitlines()[0])
