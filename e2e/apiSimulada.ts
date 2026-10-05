// ============================================================
// e2e/apiSimulada.ts — SuperRH
// API 100% simulada para o teste E2E. Cada teste cria a SUA instância (estado limpo) e a instala
// no contexto do navegador com `page.route`. Garantias:
//  - requisição para fora do servidor local (produção, Neon, Google...) é BLOQUEADA e registrada
//    em `externas`; o fixture (e2e/base.ts) derruba o teste se houver alguma;
//  - endpoint que a simulação não conhece responde 404 e é registrado em `desconhecidas`
//    (o teste também falha: ou o app chamou algo novo, ou a simulação ficou para trás);
//  - toda escrita (POST/PUT/PATCH/DELETE) fica em `escritas`, com o corpo, para o teste conferir.
// Os formatos de resposta seguem o front real (conexoes/*.ts) e as funções de api/*/index.ts.
// ============================================================

import type { BrowserContext, Request, Route } from '@playwright/test';
import type {
  AnalyticsOverview, Absence, Employee, EmployeeAtRisk, Event, Notice, PulseSurvey, SurveyQuestion, User,
} from '../tipos/modelos';

export const ORIGEM = 'http://127.0.0.1:4173';

/** Credenciais fictícias aceitas pelo login simulado. */
export const CREDENCIAIS = { usuario: 'ana.rh', senha: 'senha-de-teste-123' } as const;

export const USUARIO_RH: User = { id: 1, company_id: 1, name: 'Ana Paula RH', email: 'ana.rh@exemplo.test', role: 'rh' };

export interface Escrita {
  metodo: string;
  /** Caminho com a query, ex.: "/api/absences/1". */
  caminho: string;
  corpo: unknown;
}

type CorpoJson = Record<string, unknown>;

/** Data de hoje (AAAA-MM-DD) no fuso do navegador do teste. */
export function hojeIso(deslocamentoDias = 0): string {
  const d = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

function agoraIso(): string {
  return new Date().toISOString();
}

function base64url(objeto: object): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

/** JWT de mentira (sem assinatura válida): o app só lê o `exp`. */
export function gerarToken(usuario: User = USUARIO_RH): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: usuario.id, company_id: usuario.company_id, role: usuario.role, name: usuario.name, exp })}.assinatura-fake`;
}

function pessoa(id: number, name: string, role_title: string, status: Employee['status'] = 'ativo', extras: Partial<Employee> = {}): Employee {
  return {
    id, company_id: 1, name, role_title, status,
    hire_date: '2022-03-01', department_id: 1, department_name: 'Jurídico',
    vacation_days: 30, folga_hours: 8, email: null,
    created_at: '2022-03-01T10:00:00.000Z', updated_at: '2022-03-01T10:00:00.000Z',
    ...extras,
  };
}

function risco(e: Employee, dias: number, faltas: number, pulso: number | null): EmployeeAtRisk {
  return { id: e.id, name: e.name, department_name: e.department_name ?? null, role_title: e.role_title, days_in_company: dias, absences_90d: faltas, avg_pulse_score: pulso };
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000) + 1;
}

export class ApiSimulada {
  employees: Employee[] = [
    pessoa(1, 'Ana Souza', 'Advogada', 'ativo', { folga_hours: 10 }),
    pessoa(2, 'Bruno Lima', 'Analista Jurídico', 'ativo', { vacation_days: 20 }),
    pessoa(3, 'Carla Dias', 'Estagiária', 'ativo'),
    pessoa(4, 'Diego Rocha', 'Assistente Administrativo', 'ativo'),
    pessoa(5, 'Elisa Prado', 'Advogada', 'ferias'),
  ];

  absences: Absence[] = [{
    id: 1, company_id: 1, employee_id: 2, employee_name: 'Bruno Lima', role_title: 'Analista Jurídico',
    type: 'ferias', start_date: hojeIso(30), end_date: hojeIso(39), days_count: 10, status: 'pendente',
    reason: 'Viagem em família', created_at: agoraIso(),
  }];

  events: Event[] = [];
  notices: Notice[] = [{
    id: 1, company_id: 1, author_id: 1, author_name: 'Ana Paula RH', title: 'Recesso de fim de ano', body: 'O escritório fecha de 24/12 a 02/01.',
    priority: 'normal', pinned: false, created_at: agoraIso(),
  }];
  surveys: PulseSurvey[] = [];
  /** Aparelhos que já responderam, por pesquisa (id → voter_token). */
  respostasPorPesquisa = new Map<number, Set<string>>();
  respostasRecebidas: { pesquisa: number; corpo: CorpoJson }[] = [];

  escritas: Escrita[] = [];
  /** Requisições que tentaram sair do servidor local (bloqueadas). */
  externas: string[] = [];
  /** Endpoints que a simulação não conhece (responderam 404). */
  desconhecidas: string[] = [];
  /** Exceções JS não tratadas na página. */
  errosJs: string[] = [];

  /** true => toda rota autenticada responde 401 (sessão vencida no meio do uso). */
  sessaoExpirada = false;

  private proximoIdEvento = 1;
  private proximoIdAusencia = 2;
  private proximoIdPesquisa = 1;
  private proximoIdPergunta = 1;

  /** Níveis de risco: Ana = alto; Bruno e Carla = médio; Diego e Elisa = baixo. */
  private analytics(): AnalyticsOverview {
    const [ana, bruno, carla, diego, elisa] = this.employees;
    const alto = [risco(ana, 400, 4, 3.0)];
    const medio = [risco(bruno, 500, 2, 4.2), risco(carla, 300, 0, 3.2)];
    const baixo = [risco(diego, 700, 0, 4.5), risco(elisa, 800, 1, null)];
    return {
      summary: { total: 5, ativo: 4, ferias: 1, licenca: 0, afastado: 0, desligado: 0 },
      headcount_by_dept: [{ department: 'Jurídico', count: 5 }],
      absenteeism: { current: { days: 3, pct: 2.7 }, prev: { days: 2, pct: 1.8 } },
      turnover_risk: {
        alto: { count: alto.length, employees: alto },
        medio: { count: medio.length, employees: medio },
        baixo: { count: baixo.length, employees: baixo },
      },
      urgent_cases: [],
      climate_history: [],
      alerts: [],
    };
  }

  /** Escritas feitas com o método (e, se informado, o caminho) dados. */
  escritasDe(metodo: string, caminho?: RegExp): Escrita[] {
    return this.escritas.filter((e) => e.metodo === metodo && (!caminho || caminho.test(e.caminho)));
  }

  /** Problemas que fazem qualquer teste falhar. Vazio = tudo certo. */
  problemas(): string[] {
    return [
      ...this.externas.map((u) => `Requisição EXTERNA bloqueada (o teste nunca pode sair do servidor local): ${u}`),
      ...this.desconhecidas.map((u) => `Endpoint sem simulação (404): ${u}`),
      ...this.errosJs.map((m) => `Exceção JS não tratada na página: ${m}`),
    ];
  }

  // ── Roteamento ─────────────────────────────────────────────

  async atender(route: Route, request: Request): Promise<void> {
    const url = new URL(request.url());
    const metodo = request.method().toUpperCase();
    const caminho = url.pathname;
    const consulta = url.searchParams;
    let corpo: CorpoJson = {};
    if (metodo !== 'GET' && metodo !== 'HEAD') {
      try {
        corpo = (request.postDataJSON() ?? {}) as CorpoJson;
      } catch {
        corpo = {};
      }
      this.escritas.push({ metodo, caminho: caminho + url.search, corpo });
    }

    const responder = (status: number, dados?: unknown) => route.fulfill({
      status,
      contentType: 'application/json; charset=utf-8',
      body: dados === undefined ? '' : JSON.stringify(dados),
    });
    const erro = (status: number, mensagem: string) => responder(status, { error: mensagem });

    // ── Rotas públicas (sem token) ──
    if (caminho === '/api/auth/login' && metodo === 'POST') {
      const usuario = String(corpo.username ?? '').trim().toLowerCase();
      if (usuario === CREDENCIAIS.usuario && corpo.password === CREDENCIAIS.senha) {
        return responder(200, { token: gerarToken(), user: USUARIO_RH });
      }
      return erro(401, 'Usuário ou senha incorretos');
    }

    const mPesquisa = caminho.match(/^\/api\/surveys\/(\d+)$/);
    const mResponder = caminho.match(/^\/api\/surveys\/(\d+)\/respond$/);
    if (mPesquisa && metodo === 'GET') {
      const s = this.surveys.find((x) => x.id === Number(mPesquisa[1]));
      return s ? responder(200, s) : erro(404, 'Pesquisa não encontrada');
    }
    if (mResponder && metodo === 'POST') {
      const id = Number(mResponder[1]);
      if (!this.surveys.some((x) => x.id === id)) return erro(404, 'Pesquisa não encontrada');
      const aparelhos = this.respostasPorPesquisa.get(id) ?? new Set<string>();
      const aparelho = String(corpo.voter_token ?? '');
      if (!aparelho) return erro(400, 'voter_token obrigatório');
      if (aparelhos.has(aparelho)) return erro(409, 'Você já respondeu esta pesquisa');
      aparelhos.add(aparelho);
      this.respostasPorPesquisa.set(id, aparelhos);
      this.respostasRecebidas.push({ pesquisa: id, corpo });
      const s = this.surveys.find((x) => x.id === id);
      if (s) s.response_count = (s.response_count ?? 0) + 1;
      return responder(201, { ok: true });
    }

    // ── Daqui para baixo exige login ──
    if (this.sessaoExpirada || !request.headers().authorization?.startsWith('Bearer ')) {
      return erro(401, 'Sessão expirada');
    }

    // Empregados
    if (caminho === '/api/employees' && metodo === 'GET') {
      return responder(200, { data: this.employees, total: this.employees.length, page: 1, limit: 100, totalPages: 1 });
    }
    const mEmp = caminho.match(/^\/api\/employees\/(\d+)$/);
    if (mEmp) {
      const e = this.employees.find((x) => x.id === Number(mEmp[1]));
      if (!e) return erro(404, 'Colaborador não encontrado');
      if (metodo === 'GET') return responder(200, e);
      if (metodo === 'PUT') {
        const { folga_hours_delta, ...resto } = corpo;
        Object.assign(e, resto);
        if (typeof folga_hours_delta === 'number') e.folga_hours = Number(e.folga_hours) + folga_hours_delta;
        return responder(200, e);
      }
    }

    // Ausências
    if (caminho === '/api/absences' && metodo === 'GET') {
      const status = consulta.get('status');
      const tipo = consulta.get('type');
      const mes = consulta.get('month');
      const emp = consulta.get('employee_id');
      const limite = Number(consulta.get('limit') ?? 50);
      const filtradas = this.absences.filter((a) => (!status || a.status === status) && (!tipo || a.type === tipo) && (!mes || a.start_date.startsWith(mes)) && (!emp || a.employee_id === Number(emp)));
      return responder(200, { data: filtradas.slice(0, limite), total: filtradas.length, totalPages: Math.max(1, Math.ceil(filtradas.length / limite)) });
    }
    if (caminho === '/api/absences' && metodo === 'POST') {
      const inicio = String(corpo.start_date ?? '');
      const fim = String(corpo.end_date ?? inicio);
      const emp = this.employees.find((e) => e.id === Number(corpo.employee_id));
      const nova: Absence = {
        id: this.proximoIdAusencia++, company_id: 1, employee_id: Number(corpo.employee_id), employee_name: emp?.name, role_title: emp?.role_title,
        type: corpo.type as Absence['type'], start_date: inicio, end_date: fim, days_count: diasEntre(inicio, fim),
        status: 'aprovado', created_at: agoraIso(),
        ...(typeof corpo.hours === 'number' ? { hours: corpo.hours } : {}),
        ...(typeof corpo.reason === 'string' ? { reason: corpo.reason } : {}),
      };
      this.absences.unshift(nova);
      return responder(201, nova);
    }
    const mAus = caminho.match(/^\/api\/absences\/(\d+)$/);
    if (mAus) {
      const a = this.absences.find((x) => x.id === Number(mAus[1]));
      if (!a) return erro(404, 'Ausência não encontrada');
      if (metodo === 'PATCH') {
        if (typeof corpo.approved === 'boolean') a.status = corpo.approved ? 'aprovado' : 'recusado';
        else Object.assign(a, corpo);
        return responder(200, a);
      }
      if (metodo === 'DELETE') {
        this.absences = this.absences.filter((x) => x.id !== a.id);
        return responder(204);
      }
    }

    // Agenda
    if (caminho === '/api/events' && metodo === 'GET') {
      const mes = consulta.get('month');
      const dia = consulta.get('date');
      if (consulta.get('upcoming')) {
        const hoje = hojeIso();
        return responder(200, this.events.filter((e) => e.date >= hoje).slice(0, Number(consulta.get('limit') ?? 10)));
      }
      return responder(200, this.events.filter((e) => (!mes || e.date.startsWith(mes)) && (!dia || e.date === dia)));
    }
    if (caminho === '/api/events' && metodo === 'POST') {
      const novo = { id: `ev-${this.proximoIdEvento++}`, company_id: 1, user_id: 1, created_at: agoraIso(), updated_at: agoraIso(), ...corpo } as Event;
      this.events.push(novo);
      return responder(201, novo);
    }

    // Avisos, notificações, push, holerites, analytics
    if (caminho === '/api/notices' && metodo === 'GET') return responder(200, { data: this.notices, total: this.notices.length });
    if (caminho === '/api/users' && consulta.get('notifications') === '1') {
      return metodo === 'GET' ? responder(200, { notifications: [], unread: 0 }) : responder(200, { ok: true });
    }
    if (caminho === '/api/users' && consulta.get('push') === '1') return responder(200, { ok: true });
    if (caminho === '/api/payslips' && metodo === 'GET') return responder(200, []);
    if (caminho === '/api/analytics' && metodo === 'GET') {
      return consulta.get('view') === 'insights' ? responder(200, { insights: [], cached: false }) : responder(200, this.analytics());
    }

    // Pesquisas / NPS (área do RH)
    if (caminho === '/api/surveys' && metodo === 'GET') {
      const publico = consulta.get('audience') ?? 'employees';
      const lista = this.surveys.filter((s) => (s.audience ?? 'employees') === publico).map((s) => ({ ...s, question_count: s.questions?.length ?? 0 }));
      return responder(200, lista);
    }
    if (caminho === '/api/surveys' && metodo === 'POST') {
      const perguntas = (Array.isArray(corpo.questions) ? corpo.questions : []) as CorpoJson[];
      const questions: SurveyQuestion[] = perguntas.map((p, i) => ({
        id: this.proximoIdPergunta++, position: i + 1, question: String(p.question), type: p.type as SurveyQuestion['type'],
        options: Array.isArray(p.options) ? (p.options as string[]) : null, required: p.required !== false,
      }));
      const nova: PulseSurvey = {
        id: this.proximoIdPesquisa++, company_id: 1, created_by: 1, title: String(corpo.title ?? ''),
        audience: corpo.audience === 'customers' ? 'customers' : 'employees', target_dept: null,
        expires_at: (corpo.expires_at as string | null | undefined) ?? null, created_at: agoraIso(), questions, response_count: 0,
      };
      this.surveys.unshift(nova);
      return responder(201, nova);
    }
    if (mPesquisa && metodo === 'DELETE') {
      this.surveys = this.surveys.filter((s) => s.id !== Number(mPesquisa[1]));
      return responder(204);
    }
    const mResultados = caminho.match(/^\/api\/surveys\/(\d+)\/results$/);
    if (mResultados && metodo === 'GET') {
      const s = this.surveys.find((x) => x.id === Number(mResultados[1]));
      if (!s) return erro(404, 'Pesquisa não encontrada');
      return responder(200, { survey: s, total_responses: s.response_count ?? 0, questions: [], contacts: [] });
    }

    this.desconhecidas.push(`${metodo} ${caminho}${url.search}`);
    return erro(404, `Endpoint não simulado: ${metodo} ${caminho}`);
  }

  /** Liga a simulação ao navegador: tudo fora do servidor local é bloqueado e registrado. */
  async instalar(context: BrowserContext): Promise<void> {
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== ORIGEM) {
        this.externas.push(`${request.method()} ${request.url()}`);
        await route.abort('blockedbyclient');
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        await this.atender(route, request);
        return;
      }
      await route.continue();
    });
  }
}
