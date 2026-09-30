-- Migration 016: perguntas próprias e participações anônimas em pesquisas de pulso.
-- Impacto: cria três tabelas e índices; recria a constraint de tipo de pulse_surveys
-- para aceitar 'text'; faz backfill das pesquisas e respostas antigas sem removê-las.
-- Respostas legadas sem voter_token recebem somente um marcador opaco derivado do ID
-- técnico da resposta, preservando a relação 1:1 e permitindo reexecução sem duplicar dados.
-- Rollback: após confirmar que não há pesquisas novas do tipo 'text' nem dados a preservar:
--   DROP TABLE IF EXISTS survey_answers;
--   DROP TABLE IF EXISTS survey_submissions;
--   DROP TABLE IF EXISTS survey_questions;
--   ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_type_check;
--   ALTER TABLE pulse_surveys ADD CONSTRAINT pulse_surveys_type_check CHECK (type IN ('scale', 'choice'));

BEGIN;

ALTER TABLE pulse_surveys DROP CONSTRAINT IF EXISTS pulse_surveys_type_check;
ALTER TABLE pulse_surveys
  ADD CONSTRAINT pulse_surveys_type_check CHECK (type IN ('scale', 'choice', 'text'));

CREATE TABLE IF NOT EXISTS survey_questions (
  id           serial PRIMARY KEY,
  survey_id    integer NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 10),
  question     text NOT NULL CHECK (char_length(btrim(question)) > 0),
  type         text NOT NULL CHECK (type IN ('scale', 'choice', 'text')),
  options      jsonb,
  required     boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, position),
  CHECK (
    CASE WHEN type = 'choice'
      THEN jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 8
      ELSE options IS NULL
    END
  )
);

CREATE TABLE IF NOT EXISTS survey_submissions (
  id           serial PRIMARY KEY,
  survey_id    integer NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  voter_token  text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id              serial PRIMARY KEY,
  submission_id   integer NOT NULL REFERENCES survey_submissions(id) ON DELETE CASCADE,
  question_id     integer NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  score           integer,
  choice          text,
  text            text,
  UNIQUE (submission_id, question_id),
  CHECK (
    (score BETWEEN 1 AND 5 AND choice IS NULL AND text IS NULL)
    OR (score IS NULL AND choice IS NOT NULL AND text IS NULL AND char_length(btrim(choice)) > 0)
    OR (score IS NULL AND choice IS NULL AND text IS NOT NULL AND char_length(btrim(text)) BETWEEN 1 AND 1000)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS survey_submissions_survey_voter_idx
  ON survey_submissions (survey_id, voter_token) WHERE voter_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS survey_submissions_survey_idx ON survey_submissions (survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS survey_answers_submission_idx ON survey_answers (submission_id);
CREATE INDEX IF NOT EXISTS survey_answers_question_idx ON survey_answers (question_id);

INSERT INTO survey_questions (survey_id, position, question, type, options, required, created_at)
SELECT id, 1, question, type, options, true, created_at
FROM pulse_surveys
ON CONFLICT (survey_id, position) DO NOTHING;

WITH respostas_legadas AS (
  SELECT r.id, r.survey_id, COALESCE(r.voter_token, 'legacy:' || md5(r.id::text)) AS voter_token, r.responded_at
  FROM pulse_responses r
)
INSERT INTO survey_submissions (survey_id, voter_token, submitted_at)
SELECT survey_id, voter_token, responded_at
FROM respostas_legadas
ON CONFLICT (survey_id, voter_token) WHERE voter_token IS NOT NULL DO NOTHING;

WITH respostas_legadas AS (
  SELECT r.id, r.survey_id, COALESCE(r.voter_token, 'legacy:' || md5(r.id::text)) AS voter_token,
    r.score, r.choice
  FROM pulse_responses r
)
INSERT INTO survey_answers (submission_id, question_id, score, choice, text)
SELECT s.id, q.id, r.score, r.choice, NULL
FROM respostas_legadas r
JOIN survey_submissions s ON s.survey_id = r.survey_id AND s.voter_token = r.voter_token
JOIN survey_questions q ON q.survey_id = r.survey_id AND q.position = 1
ON CONFLICT (submission_id, question_id) DO NOTHING;

COMMIT;
