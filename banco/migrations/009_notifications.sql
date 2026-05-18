-- Migration 009: Notification center
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE, -- NULL = todos da empresa
  title      TEXT NOT NULL,
  body       TEXT,
  type       VARCHAR(30),  -- 'ferias' | 'aviso' | 'pesquisa' | 'onboarding' | 'reconhecimento'
  route      TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user   ON notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_company ON notifications (company_id, read, created_at DESC);
