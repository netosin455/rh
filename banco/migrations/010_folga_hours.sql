-- Migration 010: Banco de horas de folga
-- Saldo de horas de folga/compensação por colaborador (mesmo padrão de vacation_days,
-- mas em horas) + registro opcional de horas por lançamento de ausência tipo 'folga'.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS folga_hours numeric(6,2) NOT NULL DEFAULT 0;

ALTER TABLE absences  ADD COLUMN IF NOT EXISTS hours numeric(5,2);
