-- ============================================================
-- MIGRAÇÃO 002 — Pulse Surveys
-- Tabelas de pesquisas de pulso e respostas anônimas
-- ============================================================

CREATE TABLE IF NOT EXISTS pulse_surveys (
  id           serial PRIMARY KEY,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by   integer REFERENCES users(id) ON DELETE SET NULL,
  title        text NOT NULL,
  question     text NOT NULL,
  type         text NOT NULL DEFAULT 'scale'
                 CHECK (type IN ('scale', 'choice')),
  options      jsonb,          -- para tipo 'choice': ["Ótimo","Bom","Regular","Ruim"]
  target_dept  integer REFERENCES departments(id) ON DELETE SET NULL, -- NULL = toda empresa
  expires_at   date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_surveys_company_idx ON pulse_surveys (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pulse_responses (
  id           serial PRIMARY KEY,
  survey_id    integer NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  score        integer CHECK (score BETWEEN 1 AND 5),  -- para tipo 'scale'
  choice       text,                                    -- para tipo 'choice'
  responded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_responses_survey_idx ON pulse_responses (survey_id);
