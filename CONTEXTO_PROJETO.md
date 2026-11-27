# Contexto do Projeto — DataWise

Documento de contexto técnico e funcional para continuidade de desenvolvimento, onboarding e preparação para deploy.

- **Repositório:** `data-wise-integrative-project`
- **Branch atual:** `login`
- **Última atualização:** 26/11/2026

---

## 1. Arquitetura Geral

O sistema é composto por **4 módulos integrados**:

```
[Frontend Vue 3 :5173] ──(JWT Bearer)──▶ [Backend Java / Spring Boot :8080] ──(HTTP /etl)──▶ [Analytics Python / FastAPI :8000]
                                                    │                                                    │
                                                    └──────────────▶ [PostgreSQL (Azure)] ◀──────────────┘
```

| Módulo | Pasta | Stack | Porta padrão | Responsabilidade |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend-vue/` | Vue 3, Vite, Tailwind CSS v4, Pinia, Vue Router, SheetJS (`xlsx`), Chart.js | `5173` | Interface pública e área logada, leitura/validação prévia de planilhas, gráficos e insights |
| **Backend** | `backend-java/` | Java 21, Spring Boot, Spring Security, JWT, JPA/Hibernate, JDBC | `8080` | Autenticação, cadastro, recuperação de senha, perfil, revalidação de planilhas, consulta e exclusão de lotes |
| **Analytics / ETL** | `analytics-python/` | Python 3, FastAPI, Uvicorn, Pandas, NumPy, SciPy, SQLAlchemy, `psycopg` | `8000` | Limpeza/padronização de planilhas, cálculos estatísticos, geração de insights e persistência no PostgreSQL |
| **Banco de Dados** | `database/` | PostgreSQL | `5432` | Tabelas compartilhadas entre Java e Python (`database/schema.sql`) |

---

## 2. Frontend (`frontend-vue`)

### Rotas (`src/router/index.js`)
- **Públicas:**
  - `/` — `Home.vue`
  - `/functionality` — `Functionality.vue`
  - `/contact` — `Contact.vue`
  - `/login` — `Login.vue`
  - `/cadastro` — `Cadastro.vue`
  - `/esqueci-senha` — `EsqueciSenha.vue`
- **Área logada (`meta: { requerAuth: true }`):**
  - `/dashboard` — `Dashboard.vue`
  - `/uploads` — `Upload.vue`
  - `/historico` — `Historico.vue`
  - `/insights` — `Insights.vue`
  - `/perfil` — `Perfil.vue`
  - `/relatorio` — `Relatorio.vue`

### Stores Pinia (`src/store/`)
- **`authStore.js`:** gerencia `token` (JWT), `usuario`, `login`, `cadastrar`, `carregarPerfil`, `atualizarPerfil`, `solicitarRecuperacao`, `redefinirSenha` e `logout`.
  - Usa `VITE_API_URL` (padrão `http://localhost:8080/api`) e `VITE_MODO_SEM_BACKEND` (`false` em integração/produção).
  - Trata expiração de sessão (`401`) exibindo ação direta para novo login em `Perfil.vue`.
- **`uploadStore.js`:** lê `.xlsx`/`.xls`/`.csv`, valida colunas no navegador, envia para o backend (`POST /api/uploads/validadas`, com fallback para `POST /etl`), busca último lote (`GET /api/uploads/ultimo`), lista histórico (`GET /api/uploads/lotes`), abre lote específico (`GET /api/uploads/{id}`) e remove lotes (`DELETE /api/uploads/{id}`).
  - Formatação de data (`formatarDataHora`) trata strings ISO sem timezone como UTC para exibir corretamente no fuso local do navegador.

### Design System e UX (`src/style.css` e `src/components/`)
- **Fonte:** `Montserrat` com classes utilitárias padronizadas (`page-title`, `page-subtitle`, `section-title`, `section-subtitle`, `card`, `px-page`).
- **Paleta:** verde da marca (`#82bfa0`, `#5f9c7d`, `#3f5f5a`), fundo off-white (`#F8FAFC`), texto chumbo (`#212121`) e cards leves com borda fina (`1px solid #e5e7eb`).
- **Componentes reutilizáveis:**
  - `AppHeader.vue` — top bar da área logada em pílula com menu responsivo e modal de confirmação ao sair.
  - `LoadingSkeleton.vue` — skeleton acessível (`role="status"`) com variantes `dashboard`, `insights`, `historico`, `perfil` e `relatorio`.
  - `ConfirmModal.vue` — modal acessível (`role="dialog"`, `Esc`, clique fora) para ações destrutivas/importantes (remover planilha, limpar histórico local, sair).
  - `BaseChart.vue` — wrapper dos gráficos.
- **Linguagem:** textos voltados ao usuário final (sem jargões técnicos como *ETL*, *Python*, *JWT* ou *PostgreSQL*).

---

## 3. Backend Java (`backend-java`)

### Endpoints principais
- **Autenticação (`AuthController` — `/api/auth`):**
  - `POST /api/auth/cadastro` — cria usuário (público; senha de 8 a 72 caracteres com letras e números).
  - `POST /api/auth/login` — autentica e retorna `{ token, tipo: "Bearer", usuario }` (público; JWT expira em 60 min).
  - `POST /api/auth/esqueci-senha` — gera código numérico de 6 dígitos com hash BCrypt e validade de 15 min (público; resposta genérica para não expor e-mails).
  - `POST /api/auth/redefinir-senha` — valida código e atualiza a senha (público).
  - `GET /api/auth/me` — retorna dados do usuário autenticado.
  - `PUT /api/auth/me` — atualiza nome/e-mail e renova o token JWT.
- **Uploads e Estatísticas (`UploadController` — `/api/uploads`):**
  - `POST /api/uploads/validadas` — revalida linhas e encaminha para o serviço Python (`/etl`).
  - `GET /api/uploads/lotes` — lista os 20 lotes mais recentes (datas serializadas em UTC ISO-8601).
  - `GET /api/uploads/ultimo` — retorna o último lote `PROCESSADO` com suas estatísticas.
  - `GET /api/uploads/{id}` — retorna lote específico com estatísticas.
  - `DELETE /api/uploads/{id}` — remove lote e todos os registros vinculados via `ON DELETE CASCADE`.

---

## 4. Analytics / ETL Python (`analytics-python`)

### Endpoints (`api.py`)
- `GET /saude` — healthcheck (`{"status": "ok"}`).
- `POST /etl` — executa limpeza (`limpeza.py`), cálculos estatísticos (`analise.py`), geração de insights (`insights.py`) e grava no PostgreSQL (`banco.py`).
- `GET /lotes` — lista últimos lotes processados (datas em UTC ISO-8601).
- `GET /lotes/ultimo` — retorna estatísticas do último lote concluído.
- `GET /lotes/{lote_id}` — retorna estatísticas de um lote específico.
- `DELETE /lotes/{lote_id}` — remove lote do PostgreSQL.
- `POST /testar` — executa limpeza e cálculo em memória sem gravar no banco.

---

## 5. Banco de Dados (`database/schema.sql`)

Tabelas no PostgreSQL:
- `usuarios` — contas, perfis (`USER` / `ADMIN`), status (`APROVADO` / `PENDENTE` / `BLOQUEADO`) e `criado_em`.
- `token_recuperacao_senha` — códigos temporários de recuperação (`codigo_hash`, `expira_em`, `usado`, FK `usuario_id` com `ON DELETE CASCADE`).
- `upload_lote` — metadados de cada planilha importada.
- `consultor`, `segmento`, `servico` — cadastros auxiliares padronizados (`UNIQUE(nome)`).
- `cliente` — clientes limpos vinculados ao lote (`UNIQUE(lote_id, codigo_cti)`, `ON DELETE CASCADE`).
- `contrato` — serviços contratados por cliente (`UNIQUE(cliente_id, servico_id)`, `ON DELETE CASCADE`).
- `estatistica_lote` — JSON consolidado de indicadores e insights por lote (`ON DELETE CASCADE`).

---

## 6. Como Rodar Localmente

### Pré-requisitos
- PostgreSQL (local ou Azure) com `database/schema.sql` executado
- Python 3 (venv em `analytics-python/.venv`)
- Java 21 (JDK 21)
- Node.js

### Arquivos de ambiente locais (ignorados pelo Git)
1. `analytics-python/.env` (baseado em `analytics-python/.env-example`)
2. `backend-java/src/main/resources/application.properties` (baseado em `backend-java/application.properties.example`)
3. `frontend-vue/.env` (baseado em `frontend-vue/.env.example`)

### Comandos (em 3 terminais)
```powershell
# Terminal 1 — Python (porta 8000)
cd analytics-python
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api:app --port 8000

# Terminal 2 — Java (porta 8080)
cd backend-java
.\mvnw.cmd spring-boot:run

# Terminal 3 — Frontend (porta 5173)
cd frontend-vue
npm install
npm run dev
```

---

## 7. Estado de Validação e Checklist de Deploy

### Validado localmente
- `backend-java`: compilação limpa de todos os 50 arquivos Java com JDK 21 (`BUILD SUCCESS`).
- `analytics-python`: compilação de sintaxe (`py_compile`) sem erros em todos os 7 módulos.
- `frontend-vue`: build de produção (`npx vite build`) concluído sem erros.
- `.gitignore`: nenhum arquivo `.env` ou `application.properties` com credenciais está rastreado pelo Git.

### Checklist para publicação em produção
- [ ] **Java:** definir `JWT_SECRET` forte (`openssl rand -base64 32`), `CORS_ORIGINS` com domínio final do frontend, `DB_URL`, `DB_USER`, `DB_PASSWORD`, `ADMIN_SENHA`, `ETL_URL`, `ETL_KEY` e manter `EXPOR_CODIGO_RECUPERACAO=false`.
- [ ] **Python:** configurar `ETL_API_KEY` igual à `ETL_KEY` do Java e restringir `allow_origins` em `analytics-python/api.py` (substituir `["*"]`).
- [ ] **Frontend:** configurar `VITE_API_URL`, `VITE_ETL_API_URL` e `VITE_MODO_SEM_BACKEND=false` no provedor de hospedagem.
- [ ] **E-mail transacional (próximo passo opcional):** integrar SMTP ou API de e-mail (ex.: Resend/SendGrid) em `AuthService.solicitarRecuperacao` para enviar o código de 6 dígitos por e-mail em produção.
