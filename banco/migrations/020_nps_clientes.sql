-- Migration 020: campanhas NPS para clientes, contato consentido e proteção por IP.
-- Impacto: adiciona audience às pesquisas, tipo nps às perguntas/campo legado, contato
--          opcional e ip_hash às participações. Dados existentes permanecem audience=employees.
-- Desenho do score: CHECK não pode consultar survey_questions.type; por isso o banco aceita
--          score inteiro de 0..10. O servidor valida estritamente scale=1..5 e nps=0..10.
-- Privacidade: só HMAC-SHA256 é persistido em ip_hash, nunca o IP puro. O hash é usado por
--          no máximo 24h; a limpeza de hashes com mais de 7 dias deve ser agendada separadamente.
-- Rollback: antes de executar, exportar contatos novos e garantir que não existam perguntas/
--          pesquisas nps ou respostas score 0/6..10. Depois remover índices, constraints e
--          colunas adicionadas e restaurar as constraints anteriores (SQL comentado ao fim).

BEGIN;

ALTER TABLE pulse_surveys
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'employees';
ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_audience_check;
ALTER TABLE pulse_surveys
  ADD CONSTRAINT pulse_surveys_audience_check CHECK (audience IN ('employees', 'customers'));
ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_type_check;
ALTER TABLE pulse_surveys
  ADD CONSTRAINT pulse_surveys_type_check CHECK (type IN ('scale', 'choice', 'text', 'nps'));

ALTER TABLE survey_questions DROP CONSTRAINT IF EXISTS survey_questions_type_check;
ALTER TABLE survey_questions
  ADD CONSTRAINT survey_questions_type_check CHECK (type IN ('scale', 'choice', 'text', 'nps'));

ALTER TABLE survey_answers DROP CONSTRAINT IF EXISTS survey_answers_check;
ALTER TABLE survey_answers
  ADD CONSTRAINT survey_answers_check CHECK (
    (score BETWEEN 0 AND 10 AND choice IS NULL AND text IS NULL)
    OR (score IS NULL AND choice IS NOT NULL AND text IS NULL AND char_length(btrim(choice)) > 0)
    OR (score IS NULL AND choice IS NULL AND text IS NOT NULL AND char_length(btrim(text)) BETWEEN 1 AND 1000)
  );

ALTER TABLE survey_submissions
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_consent boolean,
  ADD COLUMN IF NOT EXISTS contact_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_hash text;
ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_consent_check;
ALTER TABLE survey_submissions
  ADD CONSTRAINT survey_submissions_contact_consent_check CHECK (
    contact_consent IS TRUE OR (
      contact_name IS NULL AND contact_phone IS NULL AND contact_email IS NULL AND contact_resolved_at IS NULL
    )
  );
ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_name_check;
ALTER TABLE survey_submissions
  ADD CONSTRAINT survey_submissions_contact_name_check
  CHECK (contact_name IS NULL OR char_length(btrim(contact_name)) BETWEEN 1 AND 120);
ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_phone_check;
ALTER TABLE survey_submissions
  ADD CONSTRAINT survey_submissions_contact_phone_check
  CHECK (contact_phone IS NULL OR char_length(btrim(contact_phone)) BETWEEN 1 AND 30);
ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_email_check;
ALTER TABLE survey_submissions
  ADD CONSTRAINT survey_submissions_contact_email_check
  CHECK (contact_email IS NULL OR char_length(btrim(contact_email)) BETWEEN 1 AND 254);
ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_ip_hash_check;
ALTER TABLE survey_submissions
  ADD CONSTRAINT survey_submissions_ip_hash_check CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64);

CREATE INDEX IF NOT EXISTS survey_submissions_survey_ip_hash_idx
  ON survey_submissions (survey_id, ip_hash, submitted_at DESC);

COMMIT;

-- ROLLBACK (executar somente após as pré-condições descritas no cabeçalho):
-- BEGIN;
-- DROP INDEX IF EXISTS survey_submissions_survey_ip_hash_idx;
-- ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_ip_hash_check;
-- ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_email_check;
-- ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_phone_check;
-- ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_name_check;
-- ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS survey_submissions_contact_consent_check;
-- ALTER TABLE survey_submissions DROP COLUMN IF EXISTS ip_hash, DROP COLUMN IF EXISTS contact_resolved_at,
--   DROP COLUMN IF EXISTS contact_consent, DROP COLUMN IF EXISTS contact_email,
--   DROP COLUMN IF EXISTS contact_phone, DROP COLUMN IF EXISTS contact_name;
-- ALTER TABLE survey_answers DROP CONSTRAINT IF EXISTS survey_answers_check;
-- ALTER TABLE survey_answers ADD CONSTRAINT survey_answers_check CHECK (
--   (score BETWEEN 1 AND 5 AND choice IS NULL AND text IS NULL)
--   OR (score IS NULL AND choice IS NOT NULL AND text IS NULL AND char_length(btrim(choice)) > 0)
--   OR (score IS NULL AND choice IS NULL AND text IS NOT NULL AND char_length(btrim(text)) BETWEEN 1 AND 1000)
-- );
-- ALTER TABLE survey_questions DROP CONSTRAINT IF EXISTS survey_questions_type_check;
-- ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_type_check CHECK (type IN ('scale', 'choice', 'text'));
-- ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_type_check;
-- ALTER TABLE pulse_surveys ADD CONSTRAINT pulse_surveys_type_check CHECK (type IN ('scale', 'choice', 'text'));
-- ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_audience_check;
-- ALTER TABLE pulse_surveys DROP COLUMN IF EXISTS audience;
-- COMMIT;
