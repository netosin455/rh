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
  username      text NOT NULL UNIQUE,        -- usado no login (api/auth/login.ts)
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'colaborador'
                  CHECK (role IN ('super_admin', 'admin', 'rh', 'gestor', 'colaborador', 'financeiro', 'juridico', 'ti', 'adm')),
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
  email           text,                       -- destino de avisos por email (independe de conta de usuário)
  salary          numeric(12,2),
  vacation_days   integer NOT NULL DEFAULT 30, -- dias de férias disponíveis
  folga_hours     numeric(6,2) NOT NULL DEFAULT 0, -- saldo de horas de folga/compensação (banco de horas)
  deleted_at      timestamptz,                 -- soft-delete: NULL = ativo, preenchido = removido
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_company_idx    ON employees (company_id);
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees (department_id);
CREATE INDEX IF NOT EXISTS employees_status_idx     ON employees (company_id, status);
CREATE INDEX IF NOT EXISTS employees_active_idx     ON employees (company_id) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────
-- HISTÓRICO DE SALÁRIO
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_history (
  id            serial PRIMARY KEY,
  company_id    integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  old_salary    numeric(12,2),
  new_salary    numeric(12,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason        text,
  changed_by    integer REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salary_history_employee_idx ON salary_history (employee_id);

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
                    CHECK (type IN ('ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','falta','outro')),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  days_count      integer GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  hours           numeric(5,2),                -- só pra type 'folga': horas descontadas do folga_hours, se informado
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
-- CENTRAL DE NOTIFICAÇÕES (in-app)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    integer REFERENCES users(id) ON DELETE CASCADE, -- NULL = todos da empresa
  title      text NOT NULL,
  body       text,
  type       varchar(30),  -- 'ferias' | 'aviso' | 'pesquisa' | 'onboarding' | 'reconhecimento'
  route      text,
  read       boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx    ON notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_company_idx ON notifications (company_id, read, created_at DESC);

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
-- MURAL DE AVISOS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id          serial PRIMARY KEY,
  company_id  integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  priority    text NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('normal', 'importante', 'urgente')),
  pinned      boolean NOT NULL DEFAULT false,
  expires_at  date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notices_company_idx ON notices (company_id, created_at DESC);

-- ──────────────────────────────────────────────────────────
-- PESQUISAS DE PULSO
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_surveys (
  id           serial PRIMARY KEY,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by   integer REFERENCES users(id) ON DELETE SET NULL,
  title        text NOT NULL,
  question     text NOT NULL,
  type         text NOT NULL DEFAULT 'scale'
                 CHECK (type IN ('scale', 'choice', 'text')),
  options      jsonb,
  target_dept  integer REFERENCES departments(id) ON DELETE SET NULL,
  expires_at   date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_surveys_company_idx ON pulse_surveys (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pulse_responses (
  id           serial PRIMARY KEY,
  survey_id    integer NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
  score        integer CHECK (score BETWEEN 1 AND 5),
  choice       text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  voter_token  text
);

CREATE INDEX IF NOT EXISTS pulse_responses_survey_idx ON pulse_responses (survey_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_survey_voter
  ON pulse_responses (survey_id, voter_token) WHERE voter_token IS NOT NULL;

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

-- ──────────────────────────────────────────────────────────
-- FEEDBACKS INDIVIDUAIS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id              serial PRIMARY KEY,
  company_id      integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     integer NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_by      integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title           varchar(140) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 140),
  content         text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 10000),
  public_token    varchar(64) UNIQUE,
  status          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'acknowledged', 'revoked')),
  published_at    timestamptz,
  acknowledged_at timestamptz,
  acknowledgment_note text CHECK (acknowledgment_note IS NULL OR char_length(btrim(acknowledgment_note)) BETWEEN 1 AND 1000),
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'draft' AND public_token IS NULL AND published_at IS NULL AND acknowledged_at IS NULL AND revoked_at IS NULL)
    OR (status = 'published' AND public_token IS NOT NULL AND published_at IS NOT NULL AND acknowledged_at IS NULL AND revoked_at IS NULL)
    OR (status = 'acknowledged' AND public_token IS NOT NULL AND published_at IS NOT NULL AND acknowledged_at IS NOT NULL AND revoked_at IS NULL)
    OR (status = 'revoked' AND public_token IS NOT NULL AND published_at IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS feedbacks_company_created_idx ON feedbacks (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_company_status_idx ON feedbacks (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedbacks_employee_idx ON feedbacks (company_id, employee_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_feedbacks ON feedbacks;
CREATE TRIGGER set_updated_at_feedbacks
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────
-- SEED: empresa e usuário admin iniciais
-- ──────────────────────────────────────────────────────────
-- INSERT INTO companies (name, cnpj, plan)
-- VALUES ('Ferreira & Associados', '00.000.000/0001-00', 'pro');

-- INSERT INTO users (company_id, name, email, password_hash, role)
-- VALUES (1, 'Admin', 'admin@escritorio.com', '$2b$10$...hash...', 'admin');
