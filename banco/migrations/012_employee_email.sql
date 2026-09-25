-- Migration 012: email do colaborador
-- O colaborador nem sempre tem conta de usuário. Este campo é o destino dos avisos
-- por email (ex.: reconhecimentos). Idempotente e sem valor padrão: NULL = sem email.
--
-- Rollback: ALTER TABLE employees DROP COLUMN IF EXISTS email;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS email text;
