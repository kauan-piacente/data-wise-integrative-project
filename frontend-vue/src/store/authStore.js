import { defineStore } from "pinia"

// URL base da API do backend Java (Spring Boot)
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api"
// URL base da API de Analytics em Python (FastAPI)
export const ETL_API_URL = import.meta.env.VITE_ETL_API_URL || "http://localhost:8000"

// Permite usar o sistema mesmo se o backend Java estiver desligado durante desenvolvimento local
export const MODO_SEM_BACKEND = import.meta.env.VITE_MODO_SEM_BACKEND !== "false"

export const useAuthStore = defineStore("auth", {
    state: () => ({
        token: localStorage.getItem("token") || null,
        usuario: JSON.parse(localStorage.getItem("usuario") || "null"),
        carregando: false,
        erro: "",
    }),

    getters: {
        estaAutenticado: (state) => !!state.token,
    },

    actions: {
        // Envia as credenciais para o backend Java (/api/auth/login) e salva o token JWT
        async login(email, senha) {
            this.carregando = true
            this.erro = ""

            try {
                const resposta = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, senha }),
                })

                if (!resposta.ok) {
                    let detalhe = ""
                    try {
                        const errJson = await resposta.json()
                        detalhe = errJson.mensagem || errJson.erro || ""
                    } catch {
                        // ignora erro de parse
                    }
                    if (detalhe) {
                        this.erro = detalhe
                    } else if (resposta.status === 401 || resposta.status === 404) {
                        this.erro = "E-mail ou senha incorretos."
                    } else if (resposta.status === 403) {
                        this.erro = "Seu cadastro aguarda aprovação do administrador."
                    } else {
                        this.erro = "Erro ao realizar login. Tente novamente."
                    }
                    return false
                }

                // Formato retornado pelo Spring: { token: "...", tipo: "Bearer", usuario: { ... } }
                const dados = await resposta.json()
                this.token = dados.token
                this.usuario = dados.usuario ?? { nome: email.split("@")[0], email }
                localStorage.setItem("token", this.token)
                localStorage.setItem("usuario", JSON.stringify(this.usuario))
                return true
            } catch {
                // Se o backend Java estiver desligado e MODO_SEM_BACKEND estiver ativo, permite login local
                if (MODO_SEM_BACKEND) {
                    this.token = "token-local"
                    this.usuario = { nome: email.split("@")[0], email }
                    localStorage.setItem("token", this.token)
                    localStorage.setItem("usuario", JSON.stringify(this.usuario))
                    return true
                }
                this.erro = "Não foi possível conectar ao servidor (http://localhost:8080)."
                return false
            } finally {
                this.carregando = false
            }
        },

        // Cria uma nova conta no backend Java (/api/auth/cadastro)
        async cadastrar(nome, email, senha) {
            this.carregando = true
            this.erro = ""

            try {
                const resposta = await fetch(`${API_URL}/auth/cadastro`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome, email, senha }),
                })

                if (!resposta.ok) {
                    let detalhe = ""
                    try {
                        const errJson = await resposta.json()
                        detalhe = errJson.erro || errJson.mensagem || ""
                    } catch {
                        // ignora erro de parse
                    }
                    this.erro = detalhe || (resposta.status === 409
                        ? "Este e-mail já está cadastrado."
                        : "Erro ao criar conta. Verifique os dados informados.")
                    return false
                }
                return true
            } catch {
                if (MODO_SEM_BACKEND) {
                    return true
                }
                this.erro = "Não foi possível conectar ao servidor (http://localhost:8080)."
                return false
            } finally {
                this.carregando = false
            }
        },

        logout() {
            this.token = null
            this.usuario = null
            localStorage.removeItem("token")
            localStorage.removeItem("usuario")
        },
    },
})
