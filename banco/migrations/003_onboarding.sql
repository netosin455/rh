-- ============================================================
-- MIGRAÇÃO 003 — Onboarding Digital
-- Templates de trilha e processos ativos por colaborador
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_templates (
  id           serial PRIMARY KEY,
  company_id   integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  steps        jsonb NOT NULL DEFAULT '[]',
  -- [{title, description, responsible_role, days_deadline}]
  is_default   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_templates_company_idx
  ON onboarding_templates (company_id);

CREATE TABLE IF NOT EXISTS onboarding_processes (
  id             serial PRIMARY KEY,
  company_id     integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id    integer REFERENCES onboarding_templates(id) ON DELETE SET NULL,
  template_name  text NOT NULL,
  steps_snapshot jsonb NOT NULL DEFAULT '[]', -- cópia das etapas no momento de início
  steps_progress jsonb NOT NULL DEFAULT '{}',
  -- {"0": {completed, completed_at, completed_by}, ...}
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  UNIQUE (employee_id)  -- um processo ativo por colaborador
);

CREATE INDEX IF NOT EXISTS onboarding_processes_company_idx
  ON onboarding_processes (company_id);

-- Template padrão para company_id = 1
INSERT INTO onboarding_templates (company_id, name, steps, is_default)
VALUES (
  1,
  'Padrão — Novo Colaborador',
  '[
    {"title": "Assinar contrato",        "description": "Enviar contrato para assinatura digital ou presencial", "responsible_role": "rh",     "days_deadline": 1},
    {"title": "Documentação pessoal",    "description": "Recolher cópias dos documentos (RG, CPF, comprovante)", "responsible_role": "rh",     "days_deadline": 2},
    {"title": "Configurar acesso",       "description": "Criar e-mail corporativo e acessos aos sistemas",       "responsible_role": "ti",     "days_deadline": 2},
    {"title": "Apresentação ao time",    "description": "Tour pelo escritório e apresentação a todos",           "responsible_role": "gestor", "days_deadline": 3},
    {"title": "Reunião com gestor",      "description": "Alinhar expectativas, metas e fluxo de trabalho",      "responsible_role": "gestor", "days_deadline": 5},
    {"title": "Entrega de uniforme",     "description": "Entregar uniforme e crachá de identificação",          "responsible_role": "rh",     "days_deadline": 5},
    {"title": "Treinamento inicial",     "description": "Treinamento dos sistemas e processos internos",         "responsible_role": "gestor", "days_deadline": 7},
    {"title": "Feedback de integração",  "description": "Conversa de 30 dias: como está sendo a adaptação?",    "responsible_role": "rh",     "days_deadline": 30}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;
