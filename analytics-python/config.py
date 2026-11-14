"""Configuração de acesso ao banco de dados PostgreSQL a partir do arquivo .env."""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.engine import URL

# Carrega as variáveis definidas no arquivo .env desta pasta
load_dotenv(Path(__file__).resolve().parent / ".env")


def database_url() -> URL:
    """Monta a URL de conexão do SQLAlchemy usando o driver psycopg."""
    return URL.create(
        "postgresql+psycopg",
        username=os.getenv("DB_USER", "cti"),
        password=os.getenv("DB_PASSWORD", "cti123"),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "data-wize"),
        query={"sslmode": os.getenv("DB_SSLMODE", "prefer")},
    )
