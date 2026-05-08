-- Tabela para rate limiting de tentativas de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id           SERIAL PRIMARY KEY,
  email        TEXT        NOT NULL,
  failed       BOOLEAN     NOT NULL DEFAULT true,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts (email, attempted_at DESC)
  WHERE failed = true;

-- Limpa automaticamente registros com mais de 1 hora (manutenção)
-- Execute periodicamente ou via pg_cron:
-- DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 hour';
