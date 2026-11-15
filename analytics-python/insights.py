"""Geração de insights em linguagem natural a partir dos indicadores estatísticos da carteira."""
from __future__ import annotations


def brl(valor) -> str:
    """Formata um número no padrão monetário brasileiro (ex.: R$ 1.234,50)."""
    if valor is None:
        return "—"
    s = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _virg(x) -> str:
    """Substitui o ponto decimal por vírgula para exibição em português."""
    return str(x).replace(".", ",")


def gerar_insights(resumo, por_segmento, por_nivel, por_consultor, por_servico, por_mes, correlacao) -> list[str]:
    """Transforma os resultados estatísticos em frases explicativas para o painel de insights."""
    ins: list[str] = []

    if por_segmento:
        top = por_segmento[0]
        ins.append(
            f"O segmento {top['segmento']} concentra a maior carteira: "
            f"{top['clientes']} clientes ({_virg(top['percentual'])}% da base e {_virg(top['percentualFaturamento'])}% do faturamento)."
        )

    if resumo["media"] and resumo["mediana"] and resumo["media"] > resumo["mediana"] * 1.1:
        ins.append(
            f"A média de faturamento ({brl(resumo['media'])}) é maior que a mediana ({brl(resumo['mediana'])}): "
            "poucos clientes muito grandes puxam a média para cima, então a mediana descreve melhor o cliente típico."
        )
    elif resumo["media"] and resumo["mediana"]:
        ins.append(f"Média ({brl(resumo['media'])}) e mediana ({brl(resumo['mediana'])}) são próximas: a carteira é equilibrada.")

    a = next((n for n in por_nivel if n["nivel"] == "A"), None)
    if a:
        ins.append(
            f"Os {a['clientes']} clientes nível A representam {_virg(a['percentualFaturamento'])}% do faturamento total, "
            f"com apenas {_virg(a['percentual'])}% dos clientes."
        )

    if por_consultor:
        maior = max(por_consultor, key=lambda c: c["faturamentoTotal"] or 0)
        ins.append(
            f"{maior['consultor']} é o consultor com maior faturamento sob gestão "
            f"({brl(maior['faturamentoTotal'])}, {maior['clientes']} clientes)."
        )

    if por_servico:
        s = por_servico[0]
        ins.append(f"{s['servico']} é o serviço mais contratado: presente em {s['contratos']} clientes ({_virg(s['percentual'])}%).")

    if por_mes:
        pico = max(e["clientes"] for e in por_mes)
        meses = [f"{e['mes'][5:]}/{e['mes'][:4]}" for e in por_mes if e["clientes"] == pico]
        if len(meses) <= 3:
            ins.append(f"O pico de contratações foi em {', '.join(meses)} ({pico} por mês).")
        else:
            ins.append(f"As contratações ficaram distribuídas ao longo do tempo: no máximo {pico} por mês, repetido em {len(meses)} meses.")

    if correlacao["pearson"] is not None and correlacao["interpretacao"]:
        ins.append(correlacao["interpretacao"].rstrip(".") + f" (r de Pearson = {_virg(correlacao['pearson'])}).")

    return ins
