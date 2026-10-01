-- Migration 019: cria a tabela salary_history que o schema.sql já descrevia mas nunca existiu em produção.
-- Contexto: o código antigo gravava o histórico salarial com .catch(() => {}) e a falha era engolida;
--           nenhum histórico foi registrado até hoje. O código novo grava o histórico na mesma instrução
--           da atualização do colaborador e DEPENDE desta tabela.
-- Impacto: cria uma tabela nova e vazia e um índice; não altera nenhuma linha existente.
-- Ordem: rodar ANTES de publicar o código que referencia salary_history.
-- Rollback (após confirmar que não há histórico a preservar):
--   DROP TABLE IF EXISTS salary_history;

CREATE TABLE IF NOT EXISTS salary_history (
  id             serial PRIMARY KEY,
  company_id     integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  old_salary     numeric(12,2),
  new_salary     numeric(12,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason         text,
  changed_by     integer REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salary_history_employee_idx ON salary_history (employee_id);
