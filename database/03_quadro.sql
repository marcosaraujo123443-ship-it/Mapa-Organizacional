-- =============================================================================
-- MIGRAÇÃO para bancos criados antes das colunas cargos.quadro (headcount)
-- e empresas.grupo. Bancos novos já recebem as colunas pelo 01_schema.sql;
-- rodar de novo não faz mal.
-- =============================================================================
ALTER TABLE cargos ADD COLUMN IF NOT EXISTS quadro INT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS grupo VARCHAR(150);
DO $$ BEGIN
  ALTER TABLE cargos ADD CONSTRAINT ck_cargos_quadro CHECK (quadro IS NULL OR quadro >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
