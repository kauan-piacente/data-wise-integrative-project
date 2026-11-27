-- Estrutura do banco de dados PostgreSQL (Data Wise / CTI Insights)
-- Tabelas compartilhadas entre o backend Java (Spring Boot) e o ETL em Python

-- Controle de usuários e autenticação (login, perfil e aprovação de acesso)
CREATE TABLE IF NOT EXISTS usuarios (
    id          BIGSERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    email       VARCHAR(160) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    matricula   VARCHAR(30),
    turma       VARCHAR(60),
    profile     VARCHAR(20)  NOT NULL DEFAULT 'USER',
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDENTE',
    criado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Códigos temporários para recuperação de senha (armazenados sempre com hash BCrypt)
CREATE TABLE IF NOT EXISTS token_recuperacao_senha (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  BIGINT       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(255) NOT NULL,
    expira_em   TIMESTAMP    NOT NULL,
    usado       BOOLEAN      NOT NULL DEFAULT FALSE,
    criado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Registro de cada planilha enviada para processamento no ETL
CREATE TABLE IF NOT EXISTS upload_lote (
    id                BIGSERIAL PRIMARY KEY,
    arquivo_nome      VARCHAR(255) NOT NULL,
    enviado_em        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status            VARCHAR(30)  NOT NULL DEFAULT 'PROCESSANDO',
    total_linhas      INTEGER      NOT NULL DEFAULT 0,
    linhas_validas    INTEGER      NOT NULL DEFAULT 0,
    linhas_invalidas  INTEGER      NOT NULL DEFAULT 0,
    linhas_com_aviso  INTEGER      NOT NULL DEFAULT 0,
    mensagem          VARCHAR(500)
);

-- Cadastros auxiliares padronizados durante o tratamento dos dados
CREATE TABLE IF NOT EXISTS consultor (
    id    BIGSERIAL PRIMARY KEY,
    nome  VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS segmento (
    id    BIGSERIAL PRIMARY KEY,
    nome  VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS servico (
    id    BIGSERIAL PRIMARY KEY,
    nome  VARCHAR(120) NOT NULL UNIQUE
);

-- Clientes limpos e validados vinculados ao lote de origem
CREATE TABLE IF NOT EXISTS cliente (
    id                BIGSERIAL PRIMARY KEY,
    lote_id           BIGINT         NOT NULL REFERENCES upload_lote(id) ON DELETE CASCADE,
    codigo_cti        VARCHAR(60)    NOT NULL,
    nome              VARCHAR(255)   NOT NULL,
    consultor_id      BIGINT         NOT NULL REFERENCES consultor(id),
    segmento_id       BIGINT         NOT NULL REFERENCES segmento(id),
    nivel             VARCHAR(5)     NOT NULL CHECK (nivel IN ('A', 'B', 'C')),
    faturamento_anual NUMERIC(15, 2) NOT NULL,
    cidade            VARCHAR(120),
    uf                VARCHAR(2),
    UNIQUE (lote_id, codigo_cti)
);

-- Serviços contratados por cada cliente
CREATE TABLE IF NOT EXISTS contrato (
    id               BIGSERIAL PRIMARY KEY,
    cliente_id       BIGINT NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
    servico_id       BIGINT NOT NULL REFERENCES servico(id),
    data_contratacao DATE   NOT NULL,
    UNIQUE (cliente_id, servico_id)
);

-- Resultado consolidado da análise estatística e dos insights do lote (armazenado em JSON)
CREATE TABLE IF NOT EXISTS estatistica_lote (
    id        BIGSERIAL PRIMARY KEY,
    lote_id   BIGINT    NOT NULL UNIQUE REFERENCES upload_lote(id) ON DELETE CASCADE,
    gerado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultado TEXT      NOT NULL
);

-- Índices para acelerar as buscas por lote e por data de envio
CREATE INDEX IF NOT EXISTS idx_cliente_lote ON cliente(lote_id);
CREATE INDEX IF NOT EXISTS idx_contrato_cliente ON contrato(cliente_id);
CREATE INDEX IF NOT EXISTS idx_upload_lote_enviado_em ON upload_lote(enviado_em DESC);
