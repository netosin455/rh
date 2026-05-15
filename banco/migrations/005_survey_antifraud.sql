-- ============================================================
-- Migration 005 — Antifraude nas Pesquisas de Pulso
-- Adiciona voter_token em pulse_responses para garantir
-- "uma resposta por dispositivo" sem quebrar o anonimato.
-- ============================================================

ALTER TABLE pulse_responses
  ADD COLUMN IF NOT EXISTS voter_token text;

-- Índice único: mesmo token não pode responder a mesma pesquisa duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_voter
  ON pulse_responses (survey_id, voter_token)
  WHERE voter_token IS NOT NULL;
