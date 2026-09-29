-- Migration 015: permite registrar a ausência do tipo falta.
-- Impacto: recria a constraint de tipo em absences; o ALTER TABLE obtém lock breve,
-- não altera as linhas existentes e passa a aceitar 'falta' além dos tipos atuais.
-- Rollback: depois de remover ou converter todas as ausências do tipo 'falta', execute:
--   ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;
--   ALTER TABLE absences ADD CONSTRAINT absences_type_check
--     CHECK (type IN ('ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','outro'));

ALTER TABLE absences DROP CONSTRAINT IF EXISTS absences_type_check;

ALTER TABLE absences
  ADD CONSTRAINT absences_type_check
  CHECK (type IN ('ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','falta','outro'));
