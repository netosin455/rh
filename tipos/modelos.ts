// ============================================================
// TYPES — SuperRH
// Todos os tipos centralizados aqui
// ============================================================

// ── Usuário e Auth ──────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'rh' | 'gestor' | 'colaborador' | 'financeiro' | 'juridico' | 'ti' | 'adm';

export interface User {
  id: number;
  company_id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

// ── Empresa ─────────────────────────────────────────────────
export interface Company {
  id: number;
  name: string;
  cnpj?: string;
  plan: 'basic' | 'pro' | 'enterprise';
}

// ── Colaborador ─────────────────────────────────────────────
export type EmployeeStatus = 'ativo' | 'ferias' | 'licenca' | 'afastado' | 'desligado';

export type LegalArea =
  | 'civel'
  | 'trabalhista'
  | 'tributario'
  | 'familia'
  | 'criminal'
  | 'empresarial'
  | 'outro';

export interface Employee {
  id: number;
  company_id: number;
  user_id?: number;
  name: string;
  cpf?: string;
  birth_date?: string;       // "YYYY-MM-DD"
  hire_date: string;
  department_id?: number;
  department_name?: string;  // via JOIN
  role_title: string;
  legal_area?: LegalArea;
  oab_number?: string;
  manager_id?: number;
  status: EmployeeStatus;
  photo_url?: string;
  phone?: string;
  salary?: number;
  vacation_days: number;
  created_at: string;
  updated_at: string;
}

export type CreateEmployeeData = Omit<Employee, 'id' | 'company_id' | 'created_at' | 'updated_at'>;
export type UpdateEmployeeData = Partial<CreateEmployeeData>;

// ── Departamento ─────────────────────────────────────────────
export interface Department {
  id: number;
  company_id: number;
  name: string;
  manager_id?: number;
}

// ── Evento da Agenda ─────────────────────────────────────────
export type EventCategory = 'audiencia' | 'reuniao' | 'prazo' | 'pericia' | 'outro';

export interface Event {
  id: string;
  company_id: number;
  user_id: number;
  title: string;
  description?: string;
  date: string;              // "YYYY-MM-DD"
  start_time?: string;       // "HH:mm"
  end_time?: string;
  color: string;
  category: EventCategory;
  location?: string;
  is_all_day: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateEventData = Omit<Event, 'id' | 'company_id' | 'user_id' | 'created_at' | 'updated_at'>;

// ── Férias / Ausências ───────────────────────────────────────
export type AbsenceType =
  | 'ferias'
  | 'licenca_medica'
  | 'licenca_maternidade'
  | 'licenca_paternidade'
  | 'folga'
  | 'falta'
  | 'outro';

export type AbsenceStatus = 'pendente' | 'aprovado' | 'recusado' | 'cancelado';

export interface Absence {
  id: number;
  company_id: number;
  employee_id: number;
  type: AbsenceType;
  start_date: string;
  end_date: string;
  days_count: number;
  status: AbsenceStatus;
  reason?: string;
  approved_by?: number;
  approved_at?: string;
  attachment_url?: string;
  created_at: string;
}

export type CreateAbsenceData = Omit<Absence, 'id' | 'company_id' | 'days_count' | 'approved_by' | 'approved_at' | 'created_at' | 'status'> & { status?: AbsenceStatus };

// ── Rotina ───────────────────────────────────────────────────
export interface Routine {
  id: number;
  company_id: number;
  user_id: number;
  title: string;
  category: string;
  color: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  active: boolean;
  created_at: string;
}

export type CreateRoutineData = Omit<Routine, 'id' | 'company_id' | 'user_id' | 'created_at'>;

// ── Aviso (Mural) ────────────────────────────────────────────
export type NoticePriority = 'normal' | 'importante' | 'urgente';

export interface Notice {
  id: number;
  company_id: number;
  author_id: number;
  title: string;
  body: string;
  priority: NoticePriority;
  pinned: boolean;
  expires_at?: string;
  created_at: string;
  author_name?: string;
}

export type CreateNoticeData = Omit<Notice, 'id' | 'company_id' | 'created_at' | 'author_id' | 'author_name'>;

export const NOTICE_PRIORITY_LABELS: Record<NoticePriority, string> = {
  normal:     'Normal',
  importante: 'Importante',
  urgente:    'Urgente',
};

// ── Onboarding ──────────────────────────────────────────────

export interface OnboardingStep {
  title:            string;
  description:      string;
  responsible_role: string;  // 'rh' | 'gestor' | 'ti' | 'adm'
  days_deadline:    number;
}

export interface StepProgress {
  completed:     boolean;
  completed_at?: string;
  completed_by?: string;
}

export interface OnboardingTemplate {
  id:         number;
  company_id: number;
  name:       string;
  steps:      OnboardingStep[];
  is_default: boolean;
  created_at: string;
}

export interface OnboardingProcess {
  id:              number;
  company_id:      number;
  employee_id:     number;
  employee_name?:  string;
  role_title?:     string;
  department_name?: string;
  template_id:     number | null;
  template_name:   string;
  steps_snapshot:  OnboardingStep[];
  steps_progress:  Record<string, StepProgress>;
  started_at:      string;
  completed_at:    string | null;
}

// ── Pulse Surveys ────────────────────────────────────────────

export type SurveyType = 'scale' | 'choice';

export interface PulseSurvey {
  id: number;
  company_id: number;
  created_by: number | null;
  created_by_name?: string;
  title: string;
  question: string;
  type: SurveyType;
  options: string[] | null;
  target_dept: number | null;
  dept_name?: string | null;
  expires_at?: string | null;
  created_at: string;
  response_count?: number;
}

export interface SurveyResults {
  survey: PulseSurvey;
  total_responses: number;
  results: {
    avg?: number;                          // scale
    distribution: Record<string, number>; // scale: {1:n,2:n,...} | choice: {Ótimo:n,...}
  };
}

export type CreateSurveyData = Pick<PulseSurvey, 'title' | 'question' | 'type' | 'options' | 'target_dept' | 'expires_at'>;

// ── Analytics ───────────────────────────────────────────────

export type TurnoverRisk = 'alto' | 'medio' | 'baixo';

export interface EmployeeAtRisk {
  id: number;
  name: string;
  department_name: string | null;
  role_title: string;
  days_in_company: number;
  absences_90d: number;
  avg_pulse_score?: number | null;
}

export interface ClimateHistory {
  month: string;          // 'YYYY-MM'
  avg_score: number;      // 1–5
  response_count: number;
}

export interface DeptHeadcount {
  department: string;
  count: number;
}

export interface AbsenteeismPeriod {
  days: number;
  pct: number;
}

export type AlertSeverity = 'alta' | 'media';
export type AlertType = 'turnover_risk' | 'absenteeism' | 'juridico' | 'onboarding';

export interface ProactiveAlert {
  type:        AlertType;
  severity:    AlertSeverity;
  title:       string;
  description: string;
  route:       string;
  icon:        string;
}

export interface AnalyticsOverview {
  summary: {
    total: number;
    ativo: number;
    ferias: number;
    licenca: number;
    afastado: number;
    desligado: number;
  };
  headcount_by_dept: DeptHeadcount[];
  absenteeism: {
    current: AbsenteeismPeriod;
    prev:    AbsenteeismPeriod;
  };
  turnover_risk: {
    alto:  { count: number; employees: EmployeeAtRisk[] };
    medio: { count: number; employees: EmployeeAtRisk[] };
    baixo: { count: number; employees: EmployeeAtRisk[] };
  };
  urgent_cases: {
    id: number;
    case_number: string;
    title: string;
    area: string;
    deadline: string | null;
    responsible_name: string | null;
  }[];
  climate_history: ClimateHistory[];
  alerts: ProactiveAlert[];
}

// ── Reconhecimentos ─────────────────────────────────────────

export type RecognitionCategory =
  | 'trabalho_em_equipe'
  | 'inovacao'
  | 'lideranca'
  | 'atendimento'
  | 'resultado'
  | 'outro';

export interface Recognition {
  id:             number;
  company_id:     number;
  from_user_id:   number | null;
  from_name:      string;
  to_employee_id: number;
  to_name:        string;
  to_role?:       string;
  message:        string;
  category:       RecognitionCategory;
  created_at:     string;
}

export const RECOGNITION_CATEGORIES: Record<RecognitionCategory, { label: string; icon: string; color: string }> = {
  trabalho_em_equipe: { label: 'Trabalho em Equipe', icon: 'people-outline',   color: '#4A8FD4' },
  inovacao:           { label: 'Inovação',            icon: 'bulb-outline',     color: '#E8955A' },
  lideranca:          { label: 'Liderança',            icon: 'ribbon-outline',   color: '#9B72CF' },
  atendimento:        { label: 'Atendimento',          icon: 'heart-outline',    color: '#E05252' },
  resultado:          { label: 'Resultado',             icon: 'trophy-outline',   color: '#C9A84C' },
  outro:              { label: 'Outro',                 icon: 'star-outline',     color: '#8A887F' },
};

// ── Holerites ────────────────────────────────────────────────

export interface Payslip {
  id:            number;
  company_id:    number;
  employee_id:   number;
  employee_name?: string;
  month:         string;  // 'YYYY-MM'
  description?:  string;
  file_url:      string;
  created_by:    number | null;
  created_at:    string;
}

// ── Chat IA ──────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type AIActionType =
  | 'criar_evento'
  | 'listar_eventos'
  | 'buscar_eventos'
  | 'criar_rotina'
  | 'resposta';

export interface AIResponse {
  action: AIActionType;
  message: string;
  eventData?: Partial<CreateEventData>;
  routineData?: Partial<CreateRoutineData>;
  searchQuery?: string;
  targetDate?: string;
}

// ── Cores por categoria ──────────────────────────────────────
export const CATEGORY_COLORS: Record<LegalArea, string> = {
  civel:       '#C9A84C',
  trabalhista: '#4A8FD4',
  tributario:  '#E05252',
  familia:     '#9B72CF',
  criminal:    '#E8955A',
  empresarial: '#2EBD7C',
  outro:       '#8A887F',
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  audiencia: '#C9A84C',
  reuniao:   '#4A8FD4',
  prazo:     '#E05252',
  pericia:   '#9B72CF',
  outro:     '#8A887F',
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  ferias:               'Férias',
  licenca_medica:       'Licença Médica',
  licenca_maternidade:  'Licença Maternidade',
  licenca_paternidade:  'Licença Paternidade',
  folga:                'Folga',
  falta:                'Falta',
  outro:                'Outro',
};

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ativo:      'Ativo',
  ferias:     'Férias',
  licenca:    'Licença',
  afastado:   'Afastado',
  desligado:  'Desligado',
};
