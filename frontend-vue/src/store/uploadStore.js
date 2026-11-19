import { defineStore } from "pinia"
import * as XLSX from "xlsx"
import { API_URL, ETL_API_URL } from "./authStore"

// Colunas esperadas na planilha de clientes (alinhadas com o backend Java e o ETL em Python)
const CAMPOS = [
    { chave: "codigo_cliente", rotulo: "Código Cliente", obrigatorio: true },
    { chave: "nome_cliente", rotulo: "Nome Cliente", obrigatorio: true },
    { chave: "consultor", rotulo: "Consultor", obrigatorio: true },
    { chave: "segmento", rotulo: "Segmento", obrigatorio: true },
    { chave: "nivel_cliente", rotulo: "Nível", obrigatorio: true },
    { chave: "faturamento_anual", rotulo: "Faturamento Anual", obrigatorio: true },
    { chave: "servicos_contratados", rotulo: "Serviços Contratados", obrigatorio: true },
    { chave: "data_contratacao", rotulo: "Data Contratação", obrigatorio: true },
    { chave: "cidade", rotulo: "Cidade", obrigatorio: false },
    { chave: "uf", rotulo: "UF", obrigatorio: false },
    { chave: "email", rotulo: "E-mail", obrigatorio: false },
]

const NIVEIS_VALIDOS = ["A", "B", "C"]
const SEGMENTOS_VALIDOS = new Set([
    "ind", "industria", "industrial",
    "com", "comercio", "comercial",
    "serv", "servico", "servicos",
    "saude",
    "edu", "educacao",
    "tec", "ti", "tecnologia",
])
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_DATA_BR = /^\d{1,2}\/\d{1,2}\/\d{4}$/
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}([T ].*)?$/

function normalizarTexto(texto) {
    return String(texto ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

function simplesSemPontuacao(texto) {
    return String(texto ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
}

const ALIASES_COLUNAS = {
    codigo: "codigo_cliente",
    codigo_cliente: "codigo_cliente",
    codigo_do_cliente: "codigo_cliente",
    codigocliente: "codigo_cliente",
    nome: "nome_cliente",
    nome_cliente: "nome_cliente",
    nome_do_cliente: "nome_cliente",
    nome_empresa: "nome_cliente",
    nomecliente: "nome_cliente",
    consultor: "consultor",
    segmento: "segmento",
    nivel: "nivel_cliente",
    nivel_cliente: "nivel_cliente",
    nivel_do_cliente: "nivel_cliente",
    nivelcliente: "nivel_cliente",
    faturamento: "faturamento_anual",
    faturamento_anual: "faturamento_anual",
    faturamentoanual: "faturamento_anual",
    servicos: "servicos_contratados",
    servicos_contratados: "servicos_contratados",
    servicoscontratados: "servicos_contratados",
    data: "data_contratacao",
    data_contratacao: "data_contratacao",
    data_de_contratacao: "data_contratacao",
    datacontratacao: "data_contratacao",
    cidade: "cidade",
    uf: "uf",
    estado: "uf",
    e_mail: "email",
    email: "email",
}
CAMPOS.forEach((campo) => {
    ALIASES_COLUNAS[normalizarTexto(campo.chave)] = campo.chave
    ALIASES_COLUNAS[normalizarTexto(campo.rotulo)] = campo.chave
})

class ErroValidacaoPlanilha extends Error {}

export function formatarTamanho(bytes) {
    if (!bytes) return "0 KB"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return mb.toFixed(1).replace(".", ",") + " MB"
    const kb = bytes / 1024
    return kb.toFixed(1).replace(".", ",") + " KB"
}

export function formatarDataHora(data) {
    if (!data) return ""
    return new Date(data).toLocaleString("pt-BR")
}

export function formatarMoeda(valor) {
    if (valor === null || valor === undefined || valor === "" || Number.isNaN(Number(valor))) return "—"
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatarMoedaCompacta(valor) {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—"
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })
}

export function formatarMes(mes) {
    const [a, m] = String(mes).split("-").map(Number)
    if (!a || !m) return String(mes)
    return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(" de ", "/")
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Estatísticas locais: calculadas no navegador a partir das linhas válidas da
// planilha quando os serviços Java/Python não estão disponíveis. Usam apenas
// os valores reais lidos do arquivo (nenhum valor padrão é inventado).
// ---------------------------------------------------------------------------
const SEGMENTO_CANONICO = {
    ind: "Indústria", industria: "Indústria", industrial: "Indústria",
    com: "Comércio", comercio: "Comércio", comercial: "Comércio",
    serv: "Serviços", servico: "Serviços", servicos: "Serviços",
    saude: "Saúde",
    edu: "Educação", educacao: "Educação",
    tec: "Tecnologia", ti: "Tecnologia", tecnologia: "Tecnologia",
}

function titulo(texto) {
    const minusculas = new Set(["da", "de", "do", "das", "dos", "e"])
    return String(texto || "").toLowerCase().split(" ").filter(Boolean)
        .map((p, i) => (i > 0 && minusculas.has(p) ? p : p[0].toUpperCase() + p.slice(1)))
        .join(" ")
}

export function parseNumero(valor) {
    let s = String(valor ?? "").replace(/R\$|\u00A0|\s/g, "")
    if (!s || !/^-?[0-9.,]+$/.test(s)) return null
    if (s.includes(",") && s.includes(".")) {
        s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
    } else if (s.includes(",")) {
        s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, "") : s.replace(",", ".")
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, "")
    }
    const n = Number(s)
    return Number.isFinite(n) ? n : null
}

function mesDaData(texto) {
    const t = String(texto || "")
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}`
    m = t.match(/^(\d{4})-(\d{2})/)
    return m ? `${m[1]}-${m[2]}` : null
}

const pct = (parte, todo) => (todo ? Math.round((1000 * parte) / todo) / 10 : 0)

function agrupar(linhas, chaveFn, nome, totalFat) {
    const grupos = {}
    linhas.forEach((l) => {
        const k = chaveFn(l)
        if (!k) return
        grupos[k] ??= { clientes: 0, fat: 0, comFat: 0 }
        grupos[k].clientes++
        if (l.fat !== null) { grupos[k].fat += l.fat; grupos[k].comFat++ }
    })
    return Object.entries(grupos)
        .map(([k, g]) => ({
            [nome]: k,
            clientes: g.clientes,
            percentual: pct(g.clientes, linhas.length),
            faturamentoTotal: g.comFat ? g.fat : null,
            percentualFaturamento: g.comFat ? pct(g.fat, totalFat) : null,
            media: g.comFat ? g.fat / g.comFat : null,
        }))
        .sort((a, b) => b.clientes - a.clientes || String(a[nome]).localeCompare(b[nome]))
}

function calcularEstatisticasLocais(validas, totalRecebidas) {
    if (!validas.length) return null
    const linhas = validas.map((l) => ({
        ...l,
        fat: parseNumero(l.faturamento_anual),
        seg: l.segmento ? (SEGMENTO_CANONICO[simplesSemPontuacao(l.segmento).replace(/\s/g, "")] || titulo(l.segmento)) : null,
        cons: l.consultor ? titulo(l.consultor) : null,
        servicos: String(l.servicos_contratados || "").split(/[;,|]/).map((s) => s.trim()).filter(Boolean),
        mes: mesDaData(l.data_contratacao),
    }))
    const fats = linhas.map((l) => l.fat).filter((f) => f !== null).sort((a, b) => a - b)
    const totalFat = fats.reduce((a, b) => a + b, 0)
    const mediana = fats.length ? (fats.length % 2 ? fats[(fats.length - 1) / 2] : (fats[fats.length / 2 - 1] + fats[fats.length / 2]) / 2) : null

    const porNivel = agrupar(linhas, (l) => l.nivel_cliente, "nivel", totalFat).sort((a, b) => a.nivel.localeCompare(b.nivel))
    const porSegmento = agrupar(linhas, (l) => l.seg, "segmento", totalFat)
    const porConsultor = agrupar(linhas, (l) => l.cons, "consultor", totalFat)
    const porCidade = agrupar(linhas, (l) => l.cidade && titulo(l.cidade), "cidade", totalFat)

    const servicos = {}
    linhas.forEach((l) => l.servicos.forEach((s) => {
        servicos[s] ??= { contratos: 0, fat: 0, comFat: 0 }
        servicos[s].contratos++
        if (l.fat !== null) { servicos[s].fat += l.fat; servicos[s].comFat++ }
    }))
    const porServico = Object.entries(servicos)
        .map(([s, g]) => ({ servico: s, contratos: g.contratos, percentual: pct(g.contratos, linhas.length), faturamentoMedio: g.comFat ? g.fat / g.comFat : null }))
        .sort((a, b) => b.contratos - a.contratos)

    // Série mensal contínua (meses sem contratação = 0), igual ao ETL em Python
    const meses = {}
    linhas.forEach((l) => { if (l.mes) { meses[l.mes] ??= { clientes: 0, faturamento: 0 }; meses[l.mes].clientes++; meses[l.mes].faturamento += l.fat || 0 } })
    const chaves = Object.keys(meses).sort()
    const porMes = []
    if (chaves.length) {
        let [a, m] = chaves[0].split("-").map(Number)
        const [af, mf] = chaves[chaves.length - 1].split("-").map(Number)
        let acumulado = 0
        while (a < af || (a === af && m <= mf)) {
            const k = `${a}-${String(m).padStart(2, "0")}`
            acumulado += meses[k]?.clientes || 0
            porMes.push({ mes: k, clientes: meses[k]?.clientes || 0, faturamento: meses[k]?.faturamento || 0, acumulado })
            m++; if (m > 12) { m = 1; a++ }
        }
    }

    const topClientes = linhas.filter((l) => l.fat !== null).sort((a, b) => b.fat - a.fat).slice(0, 5)
        .map((l) => ({ codigo: l.codigo_cliente, nome: l.nome_cliente, segmento: l.seg, nivel: l.nivel_cliente, faturamento: l.fat, cidade: l.cidade, uf: l.uf }))

    return {
        origem: "local",
        resumo: {
            totalClientes: linhas.length,
            faturamentoTotal: fats.length ? totalFat : null,
            media: fats.length ? totalFat / fats.length : null,
            mediana,
            minimo: fats[0] ?? null,
            maximo: fats[fats.length - 1] ?? null,
            segmentoMaisFrequente: porSegmento[0]?.segmento || null,
            servicoMaisContratado: porServico[0]?.servico || null,
            mediaServicosPorCliente: Math.round((linhas.reduce((s, l) => s + l.servicos.length, 0) / linhas.length) * 100) / 100,
            consultores: porConsultor.length,
            cidadesAtendidas: porCidade.length,
            clientesSemFaturamento: linhas.length - fats.length,
        },
        porNivel, porSegmento, porConsultor, porCidade, porServico, porMes, topClientes,
        qualidade: { linhasRecebidas: totalRecebidas, linhasValidas: linhas.length, linhasInvalidas: totalRecebidas - linhas.length },
    }
}

const CHAVE_HISTORICO = "datawise:historicoArquivos"
function lerHistoricoLocal() {
    try { return JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]") } catch { return [] }
}

function cabecalhosAuth() {
    const token = localStorage.getItem("token")
    return token && token !== "token-local" ? { Authorization: `Bearer ${token}` } : {}
}

export const useUploadStore = defineStore("upload", {
    state: () => ({
        arquivo: null,
        nomeArquivo: "",
        dataUpload: null,
        historicoArquivos: lerHistoricoLocal(),
        // Lotes registrados no banco (upload_lote), obtidos do backend Java ou da API Python
        lotes: [],
        lotesCarregando: false,
        lotesErro: "",
        progresso: 0,
        carregando: false,
        mensagemErro: "",
        mensagemSucesso: "",
        dadosOriginais: [],
        dadosTratados: [],
        erros: [],
        loteId: null,
        // Objeto de estatísticas calculado pelo serviço de análise em Python
        estatisticas: null,
    }),

    getters: {
        temDados: (state) => state.dadosTratados.length > 0 || !!state.estatisticas,

        dataUploadFormatada: (state) => {
            if (!state.dataUpload) return ""
            return new Date(state.dataUpload).toLocaleString("pt-BR")
        },

        totalRegistros: (state) => {
            if (state.dadosTratados.length > 0) return state.dadosTratados.length
            return state.estatisticas?.qualidade?.linhasRecebidas || 0
        },

        totalErros: (state) => state.erros.length,

        registrosComErro: (state) => {
            const linhasUnicas = new Set(state.erros.filter((e) => e.bloqueante !== false).map((erro) => erro.linha)).size
            if (linhasUnicas > 0 || state.dadosTratados.length > 0) return linhasUnicas
            return state.estatisticas?.qualidade?.linhasInvalidas || 0
        },

        registrosValidos() {
            if (this.dadosTratados.length > 0) {
                return this.totalRegistros - this.registrosComErro
            }
            return this.estatisticas?.qualidade?.linhasValidas || 0
        },

        errosPorTipo: (state) => {
            const contagem = {}
            state.erros.forEach((erro) => {
                contagem[erro.tipo] = (contagem[erro.tipo] || 0) + 1
            })
            return contagem
        },

        // Estatísticas do ETL (Python) quando disponíveis; senão, calculadas localmente das linhas válidas
        estatisticasAtivas(state) {
            if (state.estatisticas) return state.estatisticas
            const bloqueadas = new Set(state.erros.filter((e) => e.bloqueante !== false).map((e) => e.linha))
            const validas = state.dadosTratados.filter((l) => !bloqueadas.has(l.numeroLinha))
            return calcularEstatisticasLocais(validas, state.dadosTratados.length)
        },
    },

    actions: {
        limpar() {
            this.progresso = 0
            this.mensagemErro = ""
            this.mensagemSucesso = ""
            this.dadosOriginais = []
            this.dadosTratados = []
            this.erros = []
        },

        selecionarArquivo(file) {
            this.limpar()
            this.estatisticas = null
            this.loteId = null
            this.arquivo = file
            this.nomeArquivo = file.name
            this.dataUpload = new Date()

            const extensao = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "CSV"
            this.historicoArquivos.unshift({
                id: `${this.dataUpload.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
                nome: file.name.replace(/\.[^/.]+$/, ""),
                extensao: extensao,
                tamanhoBytes: file.size,
                status: "Carregando",
                progresso: 0,
                dataUpload: this.dataUpload,
                mensagemErro: "",
                totalLinhas: null,
                linhasValidas: null,
                linhasComErro: null,
                avisos: null,
                loteId: null,
                destino: null,
            })
            if (this.historicoArquivos.length > 30) {
                this.historicoArquivos.pop()
            }
            this.salvarHistoricoLocal()
            return this.historicoArquivos[0]
        },

        salvarHistoricoLocal() {
            try { localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(this.historicoArquivos)) } catch { /* armazenamento indisponível */ }
        },

        limparHistoricoLocal() {
            this.historicoArquivos = []
            this.salvarHistoricoLocal()
        },

        // Lista os lotes gravados no banco: Java (/api/uploads/lotes) ou Python (/lotes)
        async carregarLotes() {
            this.lotesCarregando = true
            this.lotesErro = ""
            try {
                for (const url of [`${API_URL}/uploads/lotes`, `${ETL_API_URL}/lotes`]) {
                    try {
                        const resp = await fetch(url, { headers: cabecalhosAuth() })
                        if (resp.ok) {
                            this.lotes = await resp.json()
                            return true
                        }
                    } catch { /* tenta o próximo serviço */ }
                }
                this.lotesErro = "Não foi possível conectar ao backend Java nem à API Python para consultar os lotes gravados."
                return false
            } finally {
                this.lotesCarregando = false
            }
        },

        // Abre um lote específico do banco e torna suas estatísticas as ativas no Dashboard/Insights
        async abrirLote(id) {
            for (const url of [`${API_URL}/uploads/${id}`, `${ETL_API_URL}/lotes/${id}`]) {
                try {
                    const resp = await fetch(url, { headers: cabecalhosAuth() })
                    if (resp.ok) {
                        const dados = await resp.json()
                        if (!dados?.estatisticas) return false
                        this.limpar()
                        this.aplicarLoteRemoto(dados)
                        return true
                    }
                } catch { /* tenta o próximo serviço */ }
            }
            return false
        },

        marcarErro(item, mensagem) {
            this.mensagemErro = mensagem
            this.dadosOriginais = []
            this.dadosTratados = []
            this.erros = []
            if (item) {
                item.status = "Erro"
                item.mensagemErro = mensagem
                this.salvarHistoricoLocal()
            }
        },

        validarArquivo(item) {
            const nome = this.nomeArquivo.toLowerCase()
            const formatoValido = nome.endsWith(".xlsx") || nome.endsWith(".xls") || nome.endsWith(".csv")

            if (!formatoValido) {
                this.marcarErro(item, "Formato inválido. Envie um arquivo .xlsx, .xls ou .csv.")
                return false
            }
            if (!this.arquivo || this.arquivo.size === 0) {
                this.marcarErro(item, "O arquivo está vazio.")
                return false
            }
            return true
        },

        async processarPlanilha(file) {
            const item = this.selecionarArquivo(file)
            if (!this.validarArquivo(item)) return

            this.carregando = true
            try {
                this.progresso = 20
                item.progresso = 20
                const linhas = await this.lerPlanilha()
                await esperar(200)

                this.progresso = 45
                item.progresso = 45
                this.dadosOriginais = linhas
                this.dadosTratados = linhas.map((linha, idx) => this.tratarLinha(linha, idx + 2))
                await esperar(200)

                this.progresso = 70
                item.progresso = 70
                this.validarDados()

                const bloqueadas = new Set(this.erros.filter((e) => e.bloqueante !== false).map((e) => e.linha))
                item.totalLinhas = this.dadosTratados.length
                item.linhasComErro = bloqueadas.size
                item.linhasValidas = this.dadosTratados.length - bloqueadas.size
                item.avisos = this.erros.filter((e) => e.bloqueante === false).length

                // Encaminha as linhas válidas para o backend processar no ETL e salvar no PostgreSQL
                item.destino = await this.enviarParaBackend()
                item.loteId = this.loteId

                this.progresso = 100
                item.progresso = 100
                item.status = "Completo"
                this.salvarHistoricoLocal()
            } catch (error) {
                const mensagem = error instanceof ErroValidacaoPlanilha
                    ? error.message
                    : (error?.message || "Não foi possível ler ou processar a planilha.")
                this.marcarErro(item, mensagem)
            } finally {
                this.carregando = false
            }
        },

        async enviarParaBackend() {
            const linhasComErro = new Set(
                this.erros.filter((e) => e.bloqueante !== false).map((e) => e.linha)
            )
            const validas = this.dadosTratados.filter((l) => !linhasComErro.has(l.numeroLinha))
            const descartadas = this.dadosTratados.length - validas.length

            if (validas.length === 0) {
                return null
            }

            const payloadJava = {
                arquivoNome: this.nomeArquivo || "planilha.csv",
                descartadas: descartadas,
                linhas: validas.map((l) => ({
                    numeroLinha: l.numeroLinha,
                    codigoCliente: l.codigo_cliente,
                    nomeCliente: l.nome_cliente,
                    consultor: l.consultor || null,
                    segmento: l.segmento || null,
                    nivelCliente: l.nivel_cliente,
                    faturamentoAnual: l.faturamento_anual || null,
                    servicosContratados: l.servicos_contratados || null,
                    dataContratacao: l.data_contratacao,
                    cidade: l.cidade || null,
                    uf: l.uf || null,
                })),
            }

            const token = localStorage.getItem("token")
            const headers = { "Content-Type": "application/json" }
            if (token && token !== "token-local") {
                headers["Authorization"] = `Bearer ${token}`
            }

            // Envia prioritariamente pelo backend Java, que valida e aciona o serviço Python
            try {
                const resp = await fetch(`${API_URL}/uploads/validadas`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payloadJava),
                })
                if (resp.ok) {
                    const dados = await resp.json()
                    this.loteId = dados.loteId || null
                    if (dados.estatisticas) {
                        this.estatisticas = dados.estatisticas
                    } else {
                        await this.carregarUltimoLote()
                    }
                    this.mensagemSucesso = `ETL concluído no Azure PostgreSQL${this.loteId ? ` (Lote #${this.loteId})` : ""}: ${dados.linhasValidas} clientes processados.`
                    return "java"
                }
            } catch {
                // Caso o backend Java não esteja rodando, utiliza a API Python diretamente
            }

            // Comunicação direta com o serviço FastAPI em Python quando o Java estiver desligado
            try {
                const payloadPython = {
                    arquivoNome: this.nomeArquivo || "planilha.csv",
                    recebidas: this.dadosTratados.length,
                    invalidas: descartadas,
                    comAviso: this.erros.filter((e) => e.bloqueante === false).length,
                    linhas: validas.map((l) => ({
                        linha: l.numeroLinha,
                        codigo_cliente: l.codigo_cliente,
                        nome_cliente: l.nome_cliente,
                        consultor: l.consultor || null,
                        segmento: l.segmento || null,
                        nivel_cliente: l.nivel_cliente,
                        faturamento_anual: l.faturamento_anual || null,
                        servicos_contratados: l.servicos_contratados || null,
                        data_contratacao: l.data_contratacao,
                        cidade: l.cidade || null,
                        uf: l.uf || null,
                    })),
                }
                const respPy = await fetch(`${ETL_API_URL}/etl`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payloadPython),
                })
                if (respPy.ok) {
                    const dadosPy = await respPy.json()
                    this.loteId = dadosPy.loteId || null
                    this.estatisticas = dadosPy.estatisticas || null
                    this.mensagemSucesso = `ETL concluído no Azure PostgreSQL${this.loteId ? ` (Lote #${this.loteId})` : ""}: ${validas.length} clientes processados.`
                    return "python"
                }
            } catch {
                // Se nenhum serviço remoto estiver ativo, preserva a validação local na tela
            }
            return "local"
        },

        async carregarUltimoLote() {
            const token = localStorage.getItem("token")
            const headers = {}
            if (token && token !== "token-local") {
                headers["Authorization"] = `Bearer ${token}`
            }

            // Busca o último lote processado através do backend Java
            try {
                const resp = await fetch(`${API_URL}/uploads/ultimo`, { headers })
                if (resp.ok) {
                    const dados = await resp.json()
                    this.aplicarLoteRemoto(dados)
                    return true
                }
            } catch {
                // Caso o Java não responda, tenta consultar direto no serviço Python
            }

            // Busca o último lote processado diretamente na API Python
            try {
                const respPy = await fetch(`${ETL_API_URL}/lotes/ultimo`)
                if (respPy.ok) {
                    const dadosPy = await respPy.json()
                    this.aplicarLoteRemoto(dadosPy)
                    return true
                }
            } catch {
                // Nenhum servidor ativo no momento
            }
            return false
        },

        aplicarLoteRemoto(dados) {
            if (!dados || !dados.estatisticas) return
            this.loteId = dados.loteId || dados.id || null
            this.nomeArquivo = dados.arquivoNome || this.nomeArquivo || "Último lote processado"
            this.dataUpload = dados.enviadoEm ? new Date(dados.enviadoEm) : new Date()
            this.estatisticas = dados.estatisticas
        },

        async lerPlanilha() {
            const buffer = await this.arquivo.arrayBuffer()
            const workbook = XLSX.read(buffer, { type: "array", dateNF: "dd/mm/yyyy", raw: true })

            const nomeAba = workbook.SheetNames[0]
            const planilha = nomeAba ? workbook.Sheets[nomeAba] : null
            if (!planilha || !planilha["!ref"]) {
                throw new ErroValidacaoPlanilha("A planilha está vazia. Nenhum dado foi encontrado no arquivo.")
            }

            const matriz = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: "", raw: false, blankrows: false })
            const cabecalho = (matriz[0] || []).map((coluna) => String(coluna).trim())
            if (matriz.length === 0 || cabecalho.every((coluna) => coluna === "")) {
                throw new ErroValidacaoPlanilha("A planilha está vazia. Nenhum dado foi encontrado no arquivo.")
            }

            const colunasEncontradas = new Set(cabecalho.map((coluna) => this.normalizarNomeColuna(coluna)))
            const faltando = CAMPOS.filter((campo) => campo.obrigatorio && !colunasEncontradas.has(campo.chave))
            if (faltando.length > 0) {
                const nomes = faltando.map((campo) => `"${campo.rotulo}"`).join(", ")
                throw new ErroValidacaoPlanilha(
                    `Colunas obrigatórias ausentes ou com nome incorreto: ${nomes}. ` +
                    `Colunas obrigatórias esperadas: ${CAMPOS.filter((c) => c.obrigatorio).map((c) => c.rotulo).join(", ")}.`
                )
            }

            if (matriz.length < 2) {
                throw new ErroValidacaoPlanilha("A planilha possui apenas o cabeçalho, sem nenhum registro de cliente.")
            }

            const linhas = XLSX.utils.sheet_to_json(planilha, { defval: "", raw: false })

            const normalizadas = linhas.map((linha) => {
                const nova = {}
                Object.keys(linha).forEach((coluna) => {
                    nova[this.normalizarNomeColuna(coluna)] = linha[coluna]
                })
                return nova
            })

            const obrigatorios = CAMPOS.filter((campo) => campo.obrigatorio)
            const temDadosDeCliente = normalizadas.some((linha) =>
                obrigatorios.some((campo) => String(linha[campo.chave] ?? "").trim() !== "")
            )
            if (!temDadosDeCliente) {
                throw new ErroValidacaoPlanilha("O arquivo não contém dados de clientes: todas as linhas estão vazias.")
            }

            return normalizadas
        },

        normalizarNomeColuna(coluna) {
            const normalizada = normalizarTexto(coluna)
            return ALIASES_COLUNAS[normalizada] || normalizada
        },

        tratarLinha(linha, numeroLinha) {
            const limpar = (valor) => String(valor ?? "").trim().replace(/\s+/g, " ")

            return {
                numeroLinha,
                codigo_cliente: limpar(linha.codigo_cliente).toUpperCase(),
                nome_cliente: limpar(linha.nome_cliente),
                consultor: limpar(linha.consultor),
                segmento: limpar(linha.segmento),
                nivel_cliente: limpar(linha.nivel_cliente).toUpperCase(),
                faturamento_anual: limpar(linha.faturamento_anual),
                servicos_contratados: limpar(linha.servicos_contratados),
                data_contratacao: limpar(linha.data_contratacao),
                cidade: limpar(linha.cidade),
                uf: limpar(linha.uf).toUpperCase(),
                email: limpar(linha.email).toLowerCase(),
            }
        },

        validarDados() {
            this.erros = []

            this.dadosOriginais.forEach((original, indice) => {
                const tratado = this.dadosTratados[indice]
                const numeroLinha = indice + 2
                this.validarLinha(original, tratado, numeroLinha)
            })

            this.verificarDuplicados()
            this.erros.sort((a, b) => a.linha - b.linha)
        },

        validarLinha(original, tratado, linha) {
            CAMPOS.forEach((campo) => {
                const valorOriginal = String(original[campo.chave] ?? "")
                const valor = tratado[campo.chave]

                if (campo.obrigatorio && valor === "") {
                    this.registrarErro(linha, campo.rotulo, "Campo obrigatório vazio", `O campo ${campo.rotulo} não foi preenchido.`, true)
                    return
                }

                if (valorOriginal !== "" && valorOriginal !== valorOriginal.trim().replace(/\s+/g, " ")) {
                    this.registrarErro(linha, campo.rotulo, "Espaços desnecessários", `"${valorOriginal}" possui espaços extras (padronizado automaticamente).`, false)
                }
            })

            if (tratado.email && !REGEX_EMAIL.test(tratado.email)) {
                this.registrarErro(linha, "E-mail", "E-mail inválido", `"${tratado.email}" não é um e-mail válido.`, false)
            }

            if (tratado.nivel_cliente && !NIVEIS_VALIDOS.includes(tratado.nivel_cliente)) {
                this.registrarErro(linha, "Nível", "Dado fora do padrão", `Nível "${tratado.nivel_cliente}" inválido. Use A, B ou C.`, true)
            }

            if (tratado.segmento && !SEGMENTOS_VALIDOS.has(simplesSemPontuacao(tratado.segmento))) {
                this.registrarErro(linha, "Segmento", "Dado fora do padrão", `Segmento "${tratado.segmento}" não reconhecido.`, true)
            }

            if (tratado.data_contratacao && !REGEX_DATA_BR.test(tratado.data_contratacao) && !REGEX_DATA_ISO.test(tratado.data_contratacao)) {
                this.registrarErro(linha, "Data Contratação", "Dado fora do padrão", `Data "${tratado.data_contratacao}" deve estar em DD/MM/AAAA ou AAAA-MM-DD.`, true)
            }

            if (tratado.faturamento_anual) {
                const fat = parseNumero(tratado.faturamento_anual)
                if (fat === null) {
                    this.registrarErro(linha, "Faturamento Anual", "Dado fora do padrão", `"${tratado.faturamento_anual}" não é um valor numérico válido.`, true)
                } else if (fat <= 0) {
                    this.registrarErro(linha, "Faturamento Anual", "Dado fora do padrão", "Faturamento anual deve ser maior que zero.", true)
                } else if (fat >= 1e12) {
                    this.registrarErro(linha, "Faturamento Anual", "Dado fora do padrão", "Faturamento anual acima do limite permitido.", true)
                }
            }

            if (tratado.servicos_contratados && tratado.servicos_contratados.split(/[;,|]/).every((s) => !s.trim())) {
                this.registrarErro(linha, "Serviços Contratados", "Dado fora do padrão", "Nenhum serviço válido informado.", true)
            }

            if (tratado.uf && !/^[A-Za-z]{2}$/.test(tratado.uf)) {
                this.registrarErro(linha, "UF", "Dado fora do padrão", `UF "${tratado.uf}" inválida. Use a sigla com 2 letras.`, true)
            }

            ;["nome_cliente", "consultor", "cidade"].forEach((chave) => {
                const texto = tratado[chave]
                if (texto && texto.length > 2 && (texto === texto.toUpperCase() || texto === texto.toLowerCase())) {
                    const rotulo = chave === "cidade" ? "Cidade" : (chave === "consultor" ? "Consultor" : "Nome Cliente")
                    this.registrarErro(linha, rotulo, "Texto a padronizar", `"${texto}" será padronizado para formato Título pelo ETL.`, false)
                }
            })
        },

        verificarDuplicados() {
            const codigosVistos = {}

            this.dadosTratados.forEach((registro, indice) => {
                const codigo = registro.codigo_cliente
                const linha = indice + 2
                if (!codigo) return

                if (codigosVistos[codigo]) {
                    this.registrarErro(linha, "Código Cliente", "Registro duplicado", `O código ${codigo} já aparece na linha ${codigosVistos[codigo]}.`, true)
                } else {
                    codigosVistos[codigo] = linha
                }
            })
        },

        registrarErro(linha, campo, tipo, descricao, bloqueante = true) {
            this.erros.push({ linha, campo, tipo, descricao, bloqueante })
        },
    },
})
