"""Etapa de transformação do ETL: limpeza de textos, padronização de categorias e conversão de tipos."""
from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd

# Colunas esperadas na planilha de clientes (as oito primeiras são obrigatórias)
COLUNAS = [
    "codigo_cliente", "nome_cliente", "consultor", "segmento", "nivel_cliente",
    "faturamento_anual", "servicos_contratados", "data_contratacao", "cidade", "uf",
]
OBRIGATORIAS = COLUNAS[:8]

# Variações aceitas para os nomes das colunas vindos de JSON, CSV ou Excel
ALIASES_COLUNAS = {
    "codigo": "codigo_cliente",
    "codigo_cliente": "codigo_cliente",
    "codigo_do_cliente": "codigo_cliente",
    "codigocliente": "codigo_cliente",
    "nome": "nome_cliente",
    "nome_cliente": "nome_cliente",
    "nome_do_cliente": "nome_cliente",
    "nome_empresa": "nome_cliente",
    "nomecliente": "nome_cliente",
    "consultor": "consultor",
    "segmento": "segmento",
    "nivel": "nivel_cliente",
    "nivel_cliente": "nivel_cliente",
    "nivel_do_cliente": "nivel_cliente",
    "nivelcliente": "nivel_cliente",
    "faturamento": "faturamento_anual",
    "faturamento_anual": "faturamento_anual",
    "faturamentoanual": "faturamento_anual",
    "servicos": "servicos_contratados",
    "servicos_contratados": "servicos_contratados",
    "servicoscontratados": "servicos_contratados",
    "data": "data_contratacao",
    "data_contratacao": "data_contratacao",
    "data_de_contratacao": "data_contratacao",
    "datacontratacao": "data_contratacao",
    "cidade": "cidade",
    "uf": "uf",
    "estado": "uf",
    "numero_linha": "linha",
    "numerolinha": "linha",
    "linha": "linha",
}

# Mapeamento de abreviações para o nome oficial de cada segmento
SEGMENTOS = {
    "ind": "Indústria", "industria": "Indústria", "industrial": "Indústria",
    "com": "Comércio", "comercio": "Comércio", "comercial": "Comércio",
    "serv": "Serviços", "servico": "Serviços", "servicos": "Serviços",
    "saude": "Saúde",
    "edu": "Educação", "educacao": "Educação",
    "tec": "Tecnologia", "ti": "Tecnologia", "tecnologia": "Tecnologia",
}

# Mapeamento para o nome oficial de cada serviço comercializado
SERVICOS = {
    "internet dedicada": "Internet Dedicada",
    "link empresarial": "Link Empresarial",
    "firewall": "Firewall",
    "backup": "Backup",
    "mpls": "MPLS",
    "cloud": "Cloud",
}

NIVEIS = {"A", "B", "C"}
PARTICULAS = {"de", "da", "do", "das", "dos", "e"}


def _simples(texto: str) -> str:
    """Remove acentos, pontuação e deixa tudo em letras minúsculas para facilitar comparações."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", str(texto)) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", sem_acento.lower()).strip()


def _normalizar_coluna(col: str) -> str:
    """Padroniza o nome de uma coluna (converte camelCase, remove acentos e aplica aliases)."""
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(col))
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    chave = re.sub(r"[^a-z0-9]+", "_", sem_acento.lower()).strip("_")
    return ALIASES_COLUNAS.get(chave, chave)


def _vazio(v) -> bool:
    """Verifica se um valor é nulo ou NaN."""
    if v is None:
        return True
    try:
        return bool(pd.isna(v))
    except (TypeError, ValueError):
        return False


def limpar_texto(v) -> str | None:
    """Remove espaços nas extremidades e espaços duplicados; retorna None se ficar vazio."""
    if _vazio(v):
        return None
    t = re.sub(r"\s+", " ", str(v)).strip()
    return t or None


def _aplicar(serie: pd.Series, funcao) -> pd.Series:
    """Aplica uma função a cada elemento da coluna preservando valores None como dtype object."""
    return pd.Series([funcao(v) for v in serie], index=serie.index, dtype=object)


def titulo(texto: str | None) -> str | None:
    """Formata nomes próprios com iniciais maiúsculas, mantendo preposições em minúsculo."""
    if texto is None:
        return None
    palavras = texto.lower().split(" ")
    return " ".join(p if (i > 0 and p in PARTICULAS) else p.capitalize() for i, p in enumerate(palavras))


def padronizar_segmento(texto: str | None) -> tuple[str | None, bool]:
    """Retorna o nome oficial do segmento e um booleano indicando se o valor foi reconhecido."""
    if texto is None:
        return None, False
    chave = _simples(texto)
    if chave in SEGMENTOS:
        return SEGMENTOS[chave], True
    return titulo(texto), False


def padronizar_servicos(texto: str | None) -> list[str]:
    """Separa a lista de serviços contratados, padroniza os nomes e remove duplicatas."""
    if texto is None:
        return []
    vistos: list[str] = []
    for parte in re.split(r"[;,]", texto):
        parte = limpar_texto(parte)
        if not parte:
            continue
        nome = SERVICOS.get(_simples(parte)) or titulo(parte)
        if nome not in vistos:
            vistos.append(nome)
    return vistos


def parse_numero(v) -> float | None:
    """Converte valores numéricos ou textos monetários (brasileiro ou americano) para float."""
    if _vazio(v):
        return None
    if isinstance(v, (int, float)):
        return float(v) if math.isfinite(float(v)) else None
    t = re.sub(r"\s", "", str(v).replace("R$", "").replace("\u00a0", ""))
    if not re.fullmatch(r"-?[0-9.,]+", t or ""):
        return None
    if "." in t and "," in t:
        t = t.replace(".", "").replace(",", ".") if t.rfind(",") > t.rfind(".") else t.replace(",", "")
    elif "," in t:
        t = t.replace(",", "") if t.count(",") > 1 else t.replace(",", ".")
    elif "." in t and re.fullmatch(r"-?\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")
    try:
        return float(t)
    except ValueError:
        return None


def parse_data(v) -> date | None:
    """Converte datas nos formatos ISO (aaaa-mm-dd) ou brasileiro (dd/mm/aaaa) para objeto date."""
    if _vazio(v):
        return None
    if isinstance(v, (datetime, pd.Timestamp)):
        return v.date()
    if isinstance(v, date):
        return v
    t = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$", t)
    try:
        if m:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return datetime.strptime(t, "%d/%m/%Y").date()
    except ValueError:
        return None


@dataclass
class ResultadoTransformacao:
    """Agrupa os dados limpos, as linhas recusadas e as métricas de padronização."""
    tratado: pd.DataFrame
    rejeitadas: pd.DataFrame
    padronizacoes: dict[str, int] = field(default_factory=dict)
    segmentos_originais: list[dict] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


def tratar(bruto: pd.DataFrame) -> ResultadoTransformacao:
    """Executa todo o fluxo de limpeza, padronização e validação defensiva sobre o DataFrame recebido."""
    df = bruto.copy().reset_index(drop=True)
    df.columns = [_normalizar_coluna(c) for c in df.columns]
    for c in COLUNAS:
        if c not in df.columns:
            df[c] = None
    if "linha" not in df.columns:
        df["linha"] = df.index + 2
    df = df[["linha"] + COLUNAS].astype(object)

    # Limpeza inicial de espaços em branco nas colunas textuais
    brutos = {c: df[c].copy() for c in COLUNAS}
    for c in COLUNAS:
        if c not in ("faturamento_anual", "data_contratacao"):
            df[c] = _aplicar(df[c], limpar_texto)

    # Padronização de segmentos, códigos, nomes, níveis, UF e lista de serviços
    df["segmento_original"] = df["segmento"]
    padrao = [padronizar_segmento(v) for v in df["segmento"]]
    df["segmento"] = pd.Series([p[0] for p in padrao], index=df.index, dtype=object)
    desconhecidos_idx = {i for i, (v, (_, ok)) in zip(df.index, zip(df["segmento_original"], padrao)) if v is not None and not ok}

    df["codigo_cliente"] = _aplicar(df["codigo_cliente"], lambda x: x.upper() if x else x)
    df["nome_cliente"] = _aplicar(df["nome_cliente"], lambda x: titulo(x) if x and (x == x.upper() or x == x.lower()) and len(x) > 3 else x)
    df["consultor"] = _aplicar(df["consultor"], titulo)
    df["nivel_cliente"] = _aplicar(df["nivel_cliente"], lambda x: x.upper() if x else x)
    df["cidade"] = _aplicar(df["cidade"], titulo)
    df["uf"] = _aplicar(df["uf"], lambda x: x.upper() if x and len(x) == 2 and x.isalpha() else None)
    df["servicos"] = _aplicar(df["servicos_contratados"], padronizar_servicos)

    # Conversão de faturamento para float e data de contratação para date
    df["faturamento_anual"] = _aplicar(df["faturamento_anual"], parse_numero)
    df["data_contratacao"] = _aplicar(df["data_contratacao"], parse_data)

    # Validação defensiva para garantir que apenas registros íntegros sigam para a análise
    motivos: list[list[str]] = [[] for _ in range(len(df))]
    for i, row in df.iterrows():
        for c in OBRIGATORIAS:
            vazio = (not row["servicos"]) if c == "servicos_contratados" else _vazio(row[c])
            if vazio:
                motivos[i].append(f"{c}: vazio ou inválido")
        if i in desconhecidos_idx:
            motivos[i].append(f"segmento: '{row['segmento_original']}' não reconhecido")
        if not _vazio(row["nivel_cliente"]) and row["nivel_cliente"] not in NIVEIS:
            motivos[i].append(f"nivel_cliente: '{row['nivel_cliente']}' fora de A/B/C")
        if not _vazio(row["faturamento_anual"]) and row["faturamento_anual"] <= 0:
            motivos[i].append("faturamento_anual: deve ser maior do que zero")
    duplicado = df["codigo_cliente"].notna() & df["codigo_cliente"].duplicated(keep="first")
    for i in df.index[duplicado]:
        motivos[i].append("codigo_cliente: duplicado")

    recusada = pd.Series([bool(m) for m in motivos], index=df.index)
    rejeitadas = df.loc[recusada, ["linha", "codigo_cliente", "nome_cliente"]].copy()
    rejeitadas["motivo"] = [" | ".join(motivos[i]) for i in df.index[recusada]]

    # Contabiliza quantas células precisaram ser padronizadas para o relatório de qualidade
    def mudou(coluna: str, original: pd.Series) -> int:
        pares = zip(original, df[coluna])
        return sum(1 for a, b in pares if not _vazio(a) and str(a) != ("" if _vazio(b) else str(b)))

    padronizacoes = {
        "segmento": mudou("segmento", brutos["segmento"]),
        "consultor": mudou("consultor", brutos["consultor"]),
        "nivel_cliente": mudou("nivel_cliente", brutos["nivel_cliente"]),
    }

    validas_df = df[~recusada]
    if not validas_df.empty:
        contagem = (
            validas_df[["segmento_original", "segmento"]]
            .dropna()
            .value_counts()
            .reset_index(name="ocorrencias")
        )
        segmentos_originais = [
            {"original": str(r.segmento_original), "padronizado": str(r.segmento), "ocorrencias": int(r.ocorrencias)}
            for r in contagem.sort_values(["segmento", "ocorrencias"], ascending=[True, False]).itertuples()
        ]
    else:
        segmentos_originais = []

    avisos: list[str] = []
    if padronizacoes["segmento"] > 0:
        avisos.append(f"{padronizacoes['segmento']} registro(s) tiveram o nome do segmento padronizado.")
    if padronizacoes["consultor"] > 0:
        avisos.append(f"{padronizacoes['consultor']} registro(s) tiveram o nome do consultor padronizado.")
    sem_cidade = int(validas_df["cidade"].isna().sum()) if not validas_df.empty else 0
    if sem_cidade > 0:
        avisos.append(f"{sem_cidade} cliente(s) válido(s) não informaram a cidade.")

    tratado = validas_df.copy()
    if not tratado.empty:
        tratado["faturamento_anual"] = tratado["faturamento_anual"].astype(float)
        tratado["qtd_servicos"] = tratado["servicos"].map(len)
        tratado["data_contratacao"] = pd.to_datetime(tratado["data_contratacao"].astype("datetime64[ns]"))
        tratado["mes"] = tratado["data_contratacao"].dt.strftime("%Y-%m")
    else:
        tratado["qtd_servicos"] = pd.Series(dtype=int)
        tratado["mes"] = pd.Series(dtype=object)

    tratado = tratado.reset_index(drop=True)[[
        "linha", "codigo_cliente", "nome_cliente", "consultor", "segmento", "segmento_original", "nivel_cliente",
        "faturamento_anual", "servicos", "qtd_servicos", "data_contratacao", "mes", "cidade", "uf",
    ]]
    return ResultadoTransformacao(tratado, rejeitadas.reset_index(drop=True), padronizacoes, segmentos_originais, avisos)
