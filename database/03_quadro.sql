-- =============================================================================
-- MIGRAÇÃO para bancos criados antes da coluna cargos.quadro (headcount).
-- Bancos novos já recebem a coluna pelo 01_schema.sql; rodar de novo não faz mal.
-- =============================================================================
ALTER TABLE cargos ADD COLUMN IF NOT EXISTS quadro INT;
DO $$ BEGIN
  ALTER TABLE cargos ADD CONSTRAINT ck_cargos_quadro CHECK (quadro IS NULL OR quadro >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
