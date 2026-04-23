-- ============================================================
-- SUPERRH — Schema PostgreSQL Completo
-- Escritório de Advocacia + Sistema de RH
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- EMPRESAS (multitenancy)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  cnpj          text UNIQUE,
  plan          text NOT NULL DEFAULT 'basic'
                  CHECK (plan IN ('basic', 'pro', 'enterprise')),
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- USUÁRIOS DO SISTEMA
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  company_id    integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'colaborador'
                  CHECK (role IN ('super_admin', 'admin', 'rh', 'gestor', 'colaborador')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_company_idx ON users (company_id);

-- ──────────────────────────────────────────────────────────
-- DEPARTAMENTOS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id            serial PRIMARY KEY,
  company_id    integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  manager_id    integer REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- COLABORADORES (dados de RH completos)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         integer REFERENCES users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  cpf             text,
  birth_date      date,
  hire_date       date NOT NULL,
  department_id   integer REFERENCES departments(id) ON DELETE SET NULL,
  role_title      text NOT NULL,              -- ex: "Advogado Pleno", "Estagiário"
  legal_area      text,                       -- ex: "Cível", "Trabalhista", etc.
  oab_number      text,                       -- Número da OAB (para advogados)
  manager_id      integer REFERENCES employees(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo', 'ferias', 'licenca', 'afastado', 'desligado')),
  photo_url       text,
  phone           text,
  salary          numeric(12,2),
  vacation_days   integer NOT NULL DEFAULT 30, -- dias de férias disponíveis
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_company_idx    ON employees (company_id);
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees (department_id);
CREATE INDEX IF NOT EXISTS employees_status_idx     ON employees (company_id, status);

-- ──────────────────────────────────────────────────────────
-- PROCESSOS JURÍDICOS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legal_cases (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_number     text NOT NULL,              -- ex: "0012847-23.2024.8.26.0100"
  title           text NOT NULL,
  area            text NOT NULL DEFAULT 'outro'
                    CHECK (area IN ('civel','trabalhista','tributario','familia','criminal','empresarial','outro')),
  status          text NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','andamento','suspenso','encerrado','urgente')),
  client_name     text NOT NULL,
  responsible_id  integer REFERENCES employees(id) ON DELETE SET NULL,
  court           text,                       -- ex: "2ª Vara Cível de SP"
  deadline        date,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_company_idx ON legal_cases (company_id);
CREATE INDEX IF NOT EXISTS cases_status_idx  ON legal_cases (company_id, status);

-- ──────────────────────────────────────────────────────────
-- EVENTOS DA AGENDA (audiências, reuniões, prazos, etc.)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  date            text NOT NULL,             -- "YYYY-MM-DD"
  start_time      text,                      -- "HH:mm"
  end_time        text,                      -- "HH:mm"
  color           text NOT NULL DEFAULT '#C9A84C',
  category        text NOT NULL DEFAULT 'outro'
                    CHECK (category IN ('audiencia','reuniao','prazo','pericia','outro')),
  case_id         integer REFERENCES legal_cases(id) ON DELETE SET NULL,
  location        text,
  is_all_day      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_company_user_idx ON events (company_id, user_id, date);
CREATE INDEX IF NOT EXISTS events_case_idx         ON events (case_id);

-- ──────────────────────────────────────────────────────────
-- SOLICITAÇÕES DE FÉRIAS E AUSÊNCIAS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absences (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'ferias'
                    CHECK (type IN ('ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','outro')),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  days_count      integer GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  status          text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovado','recusado','cancelado')),
  reason          text,
  approved_by     integer REFERENCES users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  attachment_url  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS absences_company_idx   ON absences (company_id);
CREATE INDEX IF NOT EXISTS absences_employee_idx  ON absences (employee_id);
CREATE INDEX IF NOT EXISTS absences_status_idx    ON absences (company_id, status);

-- ──────────────────────────────────────────────────────────
-- ROTINAS RECORRENTES
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routines (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  category        text NOT NULL DEFAULT 'outro',
  color           text NOT NULL DEFAULT '#C9A84C',
  start_time      text NOT NULL,
  end_time        text NOT NULL,
  days_of_week    integer[] NOT NULL,        -- [0=Dom .. 6=Sab]
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routines_user_idx ON routines (company_id, user_id);

-- ──────────────────────────────────────────────────────────
-- NOTIFICAÇÕES AUTOMÁTICAS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type            text NOT NULL
                    CHECK (type IN ('aniversario','ferias_vencendo','prazo_processo','audiencia','personalizado')),
  channel         text NOT NULL DEFAULT 'push'
                    CHECK (channel IN ('push','email','whatsapp')),
  title           text NOT NULL,
  body            text NOT NULL,
  scheduled_for   timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text NOT NULL DEFAULT 'agendado'
                    CHECK (status IN ('agendado','enviado','erro','cancelado')),
  payload         jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_schedule_idx ON notifications (company_id, scheduled_for, status);

-- ──────────────────────────────────────────────────────────
-- TRIGGER: atualiza updated_at automaticamente
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_events ON events;
CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_employees ON employees;
CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_cases ON legal_cases;
CREATE TRIGGER set_updated_at_cases
  BEFORE UPDATE ON legal_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────
-- SEED: empresa e usuário admin iniciais
-- ──────────────────────────────────────────────────────────
-- INSERT INTO companies (name, cnpj, plan)
-- VALUES ('Ferreira & Associados', '00.000.000/0001-00', 'pro');

-- INSERT INTO users (company_id, name, email, password_hash, role)
-- VALUES (1, 'Admin', 'admin@escritorio.com', '$2b$10$...hash...', 'admin');
