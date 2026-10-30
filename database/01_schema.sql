-- =============================================================================
-- MAPEAMENTO ORGANIZACIONAL - SCHEMA POSTGRESQL
-- Hierarquia: Empresa > Departamento > Cargo > Entregável > Atividade > POP
-- Requer PostgreSQL 13+ (gen_random_uuid nativo, pg_trgm e unaccent para busca)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- busca por similaridade (ILIKE rápido)
CREATE EXTENSION IF NOT EXISTS unaccent;  -- busca sem acentos ("conferencia" acha "conferência")

-- unaccent() não é IMMUTABLE, então criamos um wrapper para usar em índices
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', $1) $$;

-- -----------------------------------------------------------------------------
-- 1. EMPRESAS
-- -----------------------------------------------------------------------------
CREATE TABLE empresas (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(200) NOT NULL,
    cnpj        CHAR(14) UNIQUE,                         -- apenas dígitos
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_empresas_cnpj CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')
);

-- -----------------------------------------------------------------------------
-- 2. DEPARTAMENTOS
-- gestor_cargo_id recebe FK depois que a tabela cargos existir (dependência circular)
-- -----------------------------------------------------------------------------
CREATE TABLE departamentos (
    id               SERIAL PRIMARY KEY,
    empresa_id       INT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome             VARCHAR(150) NOT NULL,
    gestor_cargo_id  INT,
    CONSTRAINT uq_departamentos_nome UNIQUE (empresa_id, nome)
);
CREATE INDEX ix_departamentos_empresa ON departamentos(empresa_id);

-- -----------------------------------------------------------------------------
-- 3. CARGOS (auto-relacionamento via cargo_superior_id = organograma)
-- -----------------------------------------------------------------------------
CREATE TYPE nivel_cargo AS ENUM (
    'operacional', 'tecnico', 'supervisao', 'coordenacao', 'gerencia', 'diretoria'
);

CREATE TABLE cargos (
    id                 SERIAL PRIMARY KEY,
    departamento_id    INT NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
    titulo             VARCHAR(150) NOT NULL,
    cbo                VARCHAR(10),                       -- Classificação Brasileira de Ocupações (ex: 4141-05)
    nivel              nivel_cargo NOT NULL DEFAULT 'operacional',
    cargo_superior_id  INT REFERENCES cargos(id) ON DELETE SET NULL,
    quadro             INT,                               -- quantidade de pessoas no cargo (headcount)
    CONSTRAINT ck_cargos_quadro CHECK (quadro IS NULL OR quadro >= 0),
    CONSTRAINT ck_cargos_nao_auto_superior CHECK (cargo_superior_id IS NULL OR cargo_superior_id <> id)
);
CREATE INDEX ix_cargos_departamento ON cargos(departamento_id);
CREATE INDEX ix_cargos_superior     ON cargos(cargo_superior_id);
CREATE INDEX ix_cargos_titulo_trgm  ON cargos USING gin (f_unaccent(titulo) gin_trgm_ops);

ALTER TABLE departamentos
    ADD CONSTRAINT fk_departamentos_gestor
    FOREIGN KEY (gestor_cargo_id) REFERENCES cargos(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4. ENTREGÁVEIS / KPIs
-- -----------------------------------------------------------------------------
CREATE TYPE frequencia_entrega AS ENUM (
    'diaria', 'semanal', 'quinzenal', 'mensal', 'trimestral', 'semestral', 'anual', 'sob_demanda'
);

CREATE TABLE entregaveis (
    id          SERIAL PRIMARY KEY,
    cargo_id    INT NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
    titulo      VARCHAR(200) NOT NULL,
    kpi_meta    VARCHAR(300),                             -- ex: "Acuracidade >= 99,5%"
    frequencia  frequencia_entrega NOT NULL DEFAULT 'diaria'
);
CREATE INDEX ix_entregaveis_cargo       ON entregaveis(cargo_id);
CREATE INDEX ix_entregaveis_titulo_trgm ON entregaveis USING gin (f_unaccent(titulo) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 5. ATIVIDADES (Matriz RACI)
-- R e A apontam para cargos (FK). C e I são listas -> arrays de ids de cargos.
-- -----------------------------------------------------------------------------
CREATE TABLE atividades (
    id                   SERIAL PRIMARY KEY,
    entregavel_id        INT NOT NULL REFERENCES entregaveis(id) ON DELETE CASCADE,
    nome                 VARCHAR(200) NOT NULL,
    tempo_estimado       INTERVAL,                        -- ex: '00:45:00'
    raci_responsavel_id  INT REFERENCES cargos(id) ON DELETE SET NULL,  -- R
    raci_aprovador_id    INT REFERENCES cargos(id) ON DELETE SET NULL,  -- A
    raci_consultado      INT[] NOT NULL DEFAULT '{}',                   -- C (ids de cargos)
    raci_informado       INT[] NOT NULL DEFAULT '{}'                    -- I (ids de cargos)
);
CREATE INDEX ix_atividades_entregavel ON atividades(entregavel_id);
CREATE INDEX ix_atividades_resp       ON atividades(raci_responsavel_id);
CREATE INDEX ix_atividades_aprov      ON atividades(raci_aprovador_id);
CREATE INDEX ix_atividades_consult    ON atividades USING gin (raci_consultado);
CREATE INDEX ix_atividades_inform     ON atividades USING gin (raci_informado);
CREATE INDEX ix_atividades_nome_trgm  ON atividades USING gin (f_unaccent(nome) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 6. POPs - PASSO A PASSO OPERACIONAL
-- checklist_json: [{ "ordem": 1, "item": "...", "obrigatorio": true }]
-- anexos_json:    [{ "tipo": "imagem|video|pdf", "url": "...", "descricao": "..." }]
-- -----------------------------------------------------------------------------
CREATE TABLE pops_passo_a_passo (
    id                 SERIAL PRIMARY KEY,
    atividade_id       INT NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    codigo_pop         VARCHAR(30) NOT NULL,
    versao             VARCHAR(10) NOT NULL DEFAULT '1.0',
    titulo             VARCHAR(200) NOT NULL,
    conteudo_markdown  TEXT NOT NULL DEFAULT '',
    checklist_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
    anexos_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
    data_atualizacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_pop_codigo_versao UNIQUE (codigo_pop, versao),
    CONSTRAINT ck_pop_checklist_array CHECK (jsonb_typeof(checklist_json) = 'array'),
    CONSTRAINT ck_pop_anexos_array    CHECK (jsonb_typeof(anexos_json) = 'array')
);
CREATE INDEX ix_pops_atividade      ON pops_passo_a_passo(atividade_id);
CREATE INDEX ix_pops_checklist      ON pops_passo_a_passo USING gin (checklist_json jsonb_path_ops);
CREATE INDEX ix_pops_titulo_trgm    ON pops_passo_a_passo USING gin (f_unaccent(titulo) gin_trgm_ops);
CREATE INDEX ix_pops_conteudo_trgm  ON pops_passo_a_passo USING gin (f_unaccent(conteudo_markdown) gin_trgm_ops);

-- Atualiza data_atualizacao automaticamente em todo UPDATE
CREATE OR REPLACE FUNCTION trg_pop_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.data_atualizacao := now();
    RETURN NEW;
END $$;

CREATE TRIGGER tg_pop_touch
BEFORE UPDATE ON pops_passo_a_passo
FOR EACH ROW EXECUTE FUNCTION trg_pop_touch();

COMMIT;
