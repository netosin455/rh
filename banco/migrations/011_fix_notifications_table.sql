-- Migration 011: Corrige tabela notifications
-- A tabela em produção era de um desenho antigo (notificação agendada multi-canal:
-- employee_id, channel, scheduled_for, status, payload) que nunca chegou a ser usado
-- (0 linhas). A migration 009 pretendia recriá-la no formato de central de notificações
-- in-app (user_id, read), mas usou CREATE TABLE IF NOT EXISTS — como a tabela antiga já
-- existia, o IF NOT EXISTS foi um no-op silencioso e a tabela nunca foi migrada de fato.
-- Como estava vazia, drop + recreate é seguro (sem perda de dado).

DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
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

CREATE INDEX notifications_user    ON notifications (user_id, read, created_at DESC);
CREATE INDEX notifications_company ON notifications (company_id, read, created_at DESC);
