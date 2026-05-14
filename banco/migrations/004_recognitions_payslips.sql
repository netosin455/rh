-- ============================================================
-- 004_recognitions_payslips.sql
-- Mural de Reconhecimento + Holerites Digitais
-- ============================================================

CREATE TABLE IF NOT EXISTS recognitions (
  id             SERIAL PRIMARY KEY,
  company_id     INT  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_user_id   INT  REFERENCES users(id) ON DELETE SET NULL,
  from_name      TEXT NOT NULL,
  to_employee_id INT  NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  to_name        TEXT NOT NULL,
  message        TEXT NOT NULL CHECK (length(message) <= 500),
  category       TEXT NOT NULL DEFAULT 'outro',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recognitions_company    ON recognitions(company_id);
CREATE INDEX IF NOT EXISTS idx_recognitions_to_emp     ON recognitions(to_employee_id);
CREATE INDEX IF NOT EXISTS idx_recognitions_created_at ON recognitions(created_at DESC);

-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payslips (
  id          SERIAL PRIMARY KEY,
  company_id  INT  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT  NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month       CHAR(7) NOT NULL,  -- 'YYYY-MM'
  description TEXT,
  file_url    TEXT NOT NULL,
  created_by  INT  REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id, month DESC);
