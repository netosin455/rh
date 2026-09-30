-- Migration 017: observação opcional do colaborador ao confirmar um feedback.
-- Impacto: adiciona uma coluna nullable e uma constraint de tamanho; não altera linhas existentes.
-- Rollback: ALTER TABLE feedbacks DROP CONSTRAINT IF EXISTS feedbacks_acknowledgment_note_check;
--           ALTER TABLE feedbacks DROP COLUMN IF EXISTS acknowledgment_note;

ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS acknowledgment_note text;
ALTER TABLE feedbacks DROP CONSTRAINT IF EXISTS feedbacks_acknowledgment_note_check;
ALTER TABLE feedbacks
  ADD CONSTRAINT feedbacks_acknowledgment_note_check
  CHECK (acknowledgment_note IS NULL OR char_length(btrim(acknowledgment_note)) BETWEEN 1 AND 1000);
