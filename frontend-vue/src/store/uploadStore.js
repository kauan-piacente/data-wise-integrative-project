import { defineStore } from "pinia"
import * as XLSX from "xlsx"
import { API_URL, ETL_API_URL } from "./authStore"

// Colunas esperadas na planilha de clientes (alinhadas com o backend Java e o ETL em Python)
const CAMPOS = [
    { chave: "codigo_cliente", rotulo: "Código Cliente", obrigatorio: true },
    { chave: "nome_cliente", rotulo: "Nome Cliente", obrigatorio: true },
    { chave: "consultor", rotulo: "Consultor", obrigatorio: false },
    { chave: "segmento", rotulo: "Segmento", obrigatorio: false },
    { chave: "nivel_cliente", rotulo: "Nível", obrigatorio: true },
    { chave: "faturamento_anual", rotulo: "Faturamento Anual", obrigatorio: false },
    { chave: "servicos_contratados", rotulo: "Serviços Contratados", obrigatorio: false },
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
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "R$ 0,00"
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const useUploadStore = defineStore("upload", {
    state: () => ({
        arquivo: null,
        nomeArquivo: "",
        dataUpload: null,
        historicoArquivos: [],
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
            })
            if (this.historicoArquivos.length > 4) {
                this.historicoArquivos.pop()
            }
            return this.historicoArquivos[0]
        },

        marcarErro(item, mensagem) {
            this.mensagemErro = mensagem
            this.dadosOriginais = []
            this.dadosTratados = []
            this.erros = []
            if (item) {
                item.status = "Erro"
                item.mensagemErro = mensagem
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

                // Encaminha as linhas válidas para o backend processar no ETL e salvar no PostgreSQL
                await this.enviarParaBackend()

                this.progresso = 100
                item.progresso = 100
                item.status = "Completo"
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
                return
            }

            const payloadJava = {
                arquivoNome: this.nomeArquivo || "planilha.csv",
                descartadas: descartadas,
                linhas: validas.map((l) => ({
                    numeroLinha: l.numeroLinha,
                    codigoCliente: l.codigo_cliente,
                    nomeCliente: l.nome_cliente,
                    consultor: l.consultor || "Consultor Geral",
                    segmento: l.segmento || "Serviços",
                    nivelCliente: l.nivel_cliente,
                    faturamentoAnual: l.faturamento_anual || "100000.00",
                    servicosContratados: l.servicos_contratados || "Internet Dedicada",
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
                    return
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
                        consultor: l.consultor || "Consultor Geral",
                        segmento: l.segmento || "Serviços",
                        nivel_cliente: l.nivel_cliente,
                        faturamento_anual: l.faturamento_anual || "100000.00",
                        servicos_contratados: l.servicos_contratados || "Internet Dedicada",
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
                }
            } catch {
                // Se nenhum serviço remoto estiver ativo, preserva a validação local na tela
            }
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
