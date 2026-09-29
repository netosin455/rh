-- Migration 014: feedbacks individuais com link público por token secreto.
-- Impacto: cria uma tabela nova e índices vazios; não altera dados existentes.
-- Rollback (após confirmar que nenhum feedback precisa ser preservado):
--   DROP TRIGGER IF EXISTS set_updated_at_feedbacks ON feedbacks;
--   DROP TABLE IF EXISTS feedbacks;

CREATE TABLE IF NOT EXISTS feedbacks (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     integer NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_by      integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title           varchar(140) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 140),
  content         text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 10000),
  public_token    varchar(64) UNIQUE,
  status          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'acknowledged', 'revoked')),
  published_at    timestamptz,
  acknowledged_at timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'draft' AND public_token IS NULL AND published_at IS NULL AND acknowledged_at IS NULL AND revoked_at IS NULL)
    OR (status = 'published' AND public_token IS NOT NULL AND published_at IS NOT NULL AND acknowledged_at IS NULL AND revoked_at IS NULL)
    OR (status = 'acknowledged' AND public_token IS NOT NULL AND published_at IS NOT NULL AND acknowledged_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND public_token IS NOT NULL AND published_at IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS feedbacks_company_created_idx ON feedbacks (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_company_status_idx ON feedbacks (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_employee_idx ON feedbacks (company_id, employee_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_feedbacks ON feedbacks;
CREATE TRIGGER set_updated_at_feedbacks
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
