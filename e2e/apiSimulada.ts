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
  AnalyticsOverview, Absence, Fechamento, FechamentoLinha, ProactiveAlert, Employee, EmployeeAtRisk, Event, Feedback, Notice, OnboardingProcess, PublicFeedback,
  PulseSurvey, QuestionResult, Recognition, SurveyContact, SurveyQuestion, User,
} from '../tipos/modelos';
import type { Notificacao } from '../conexoes/notificacoes';
import type { SystemUser } from '../conexoes/usuarios';

export const ORIGEM = `http://127.0.0.1:${process.env.E2E_PORTA ?? 4173}`;

/** Credenciais fictícias aceitas pelo login simulado. */
export const CREDENCIAIS = { usuario: 'ana.rh', senha: 'senha-de-teste-123' } as const;

/** Segundo usuário (outra pessoa no mesmo computador): serve para provar que o cache não vaza entre sessões. */
export const CREDENCIAIS_OUTRO = { usuario: 'bia.rh', senha: 'senha-de-teste-123' } as const;
export const USUARIO_OUTRO: User = { id: 2, company_id: 2, name: 'Beatriz Outra Empresa', email: 'bia@outra.test', role: 'rh' };

export const USUARIO_RH: User = { id: 1, company_id: 1, name: 'Ana Paula RH', email: 'ana.rh@exemplo.test', role: 'rh' };
export const USUARIO_SUPER: User = { id: 1, company_id: 1, name: 'Carlos Super', email: 'super@exemplo.test', role: 'super_admin' };

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

export function agoraIso(): string {
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
    pessoa(1, 'Ana Souza', 'Advogada', 'ativo', { folga_hours: 10, phone: '(11) 98888-7777' }),
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
  recognitions: Recognition[] = [];
  feedbacks: Feedback[] = [];
  /** Clientes que pediram contato, por pesquisa. */
  contatosPorPesquisa = new Map<number, SurveyContact[]>();
  onboardings: OnboardingProcess[] = [{
    id: 1, company_id: 1, employee_id: 3, employee_name: 'Carla Dias', role_title: 'Estagiária', department_name: 'Jurídico',
    template_id: 1, template_name: 'Onboarding padrão', started_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), completed_at: null,
    steps_snapshot: [
      { title: 'Assinar contrato', description: 'Enviar o contrato para assinatura.', responsible_role: 'rh', days_deadline: 3 },
      { title: 'Criar e-mail', description: 'Abrir a conta de e-mail.', responsible_role: 'ti', days_deadline: 5 },
      { title: 'Apresentar a equipe', description: '', responsible_role: 'gestor', days_deadline: 7 },
    ],
    steps_progress: {},
  }];
  usuarios: SystemUser[] = [
    { id: 1, company_id: 1, name: 'Carlos Super', email: 'super@exemplo.test', username: 'carlos.super', role: 'super_admin', created_at: agoraIso() },
    { id: 2, company_id: 1, name: 'Bruno Gestor', email: 'bruno@exemplo.test', username: 'bruno.gestor', role: 'gestor', created_at: agoraIso() },
  ];
  notificacoes: Notificacao[] = [
    { id: 1, title: 'Férias aprovadas', body: 'As férias de Bruno foram aprovadas.', type: 'ferias', route: null, read: false, created_at: agoraIso() },
    { id: 2, title: 'Novo aviso publicado', body: null, type: 'aviso', route: null, read: false, created_at: agoraIso() },
    { id: 3, title: 'Pesquisa encerrada', body: 'A pesquisa de clima terminou.', type: 'pesquisa', route: null, read: true, created_at: agoraIso() },
  ];
  /** Usuário devolvido pelo login simulado. */
  usuarioLogado: User = USUARIO_RH;
  /** Se preenchido, o PUT de pesquisa responde 409 edicao_bloqueada com estas mensagens (o servidor discordando do front). */
  forcarBloqueios: string[] | null = null;
  /** Alertas proativos devolvidos por GET /api/analytics (campo `alerts`). */
  alertas: ProactiveAlert[] = [];
  /** Quantas chamadas do fechamento ainda respondem 500 antes de voltar ao normal (testa o "Tentar de novo"). */
  falhasDoFechamento = 0;
  /** Atraso por endpoint (ms) para provar o que a tela mostra enquanto a API demora. */
  atrasos: { metodo?: string; padrao: RegExp; ms: number }[] = [];
  /** Falhas injetadas: as próximas `restantes` chamadas que casarem respondem com `status`. */
  falhas: { metodo: string; padrao: RegExp; status: number; restantes: number }[] = [];
  /** Chamadas que já foram RESPONDIDAS ("GET /api/notices"), para o teste esperar a resposta chegar. */
  concluidas: string[] = [];
  /** true => POST /api/chat responde 502 (IA fora do ar). */
  chatIndisponivel = false;
  /** Toda requisição que chegou à API simulada ("GET /api/employees?page=1..."). */
  chamadas: string[] = [];
  /** Chamadas /api/ em andamento agora e o maior número simultâneo já visto. */
  emAndamento = 0;
  picoSimultaneo = 0;
  private proximoIdFeedback = 1;
  private proximoIdReconhecimento = 1;
  private proximoIdContato = 1;
  private proximoIdAviso = 2;
  private proximoIdUsuario = 3;

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
    // Sem colaboradores (ou com poucos) as listas de risco ficam vazias em vez de quebrar a simulação.
    const alto = ana ? [risco(ana, 400, 4, 3.0)] : [];
    const medio = [bruno && risco(bruno, 500, 2, 4.2), carla && risco(carla, 300, 0, 3.2)].filter((r): r is EmployeeAtRisk => Boolean(r));
    const baixo = [diego && risco(diego, 700, 0, 4.5), elisa && risco(elisa, 800, 1, null)].filter((r): r is EmployeeAtRisk => Boolean(r));
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
      alerts: this.alertas,
    };
  }

  // ── Dados prontos para os testes (estado inicial) ──

  /** Cria uma pesquisa já existente (RH ou NPS) sem passar pela tela. */
  semearPesquisa(titulo: string, audience: 'employees' | 'customers', perguntas: { question: string; type: SurveyQuestion['type']; options?: string[]; required?: boolean }[]): PulseSurvey {
    const questions: SurveyQuestion[] = perguntas.map((p, i) => ({
      id: this.proximoIdPergunta++, position: i + 1, question: p.question, type: p.type, options: p.options ?? null, required: p.required !== false,
    }));
    const nova: PulseSurvey = { id: this.proximoIdPesquisa++, company_id: 1, created_by: 1, title: titulo, audience, target_dept: null, expires_at: null, created_at: agoraIso(), questions, response_count: 0 };
    this.surveys.unshift(nova);
    return nova;
  }

  /** Lançamento já APROVADO (como os que o RH cria pela tela Lançar). Não mexe no saldo: ajuste o colaborador no teste. */
  semearAusencia(dados: { employee_id: number; type: Absence['type']; start_date?: string; end_date?: string; hours?: number; days_count?: number }): Absence {
    const emp = this.employees.find((e) => e.id === dados.employee_id) ?? this.employees[0];
    const inicio = dados.start_date ?? hojeIso(-3);
    const fim = dados.end_date ?? inicio;
    const a: Absence = {
      id: this.proximoIdAusencia++, company_id: 1, employee_id: emp.id, employee_name: emp.name, role_title: emp.role_title, type: dados.type,
      start_date: inicio, end_date: fim, days_count: dados.days_count ?? diasEntre(inicio, fim), status: 'aprovado', created_at: agoraIso(),
      ...(dados.hours !== undefined ? { hours: dados.hours } : {}),
    };
    this.absences.push(a);
    return a;
  }

  /** Evento já existente na agenda. */
  semearEvento(dados: { title: string; date: string; start_time?: string; end_time?: string; category?: Event['category']; is_all_day?: boolean }): Event {
    const e = { id: `ev-${this.proximoIdEvento++}`, company_id: 1, user_id: 1, color: '#8A887F', category: 'outro', is_all_day: false, created_at: agoraIso(), updated_at: agoraIso(), ...dados } as Event;
    this.events.push(e);
    return e;
  }

  /** Resposta anônima já recebida (para a tela de resultados ter números e barras). `answers` no formato do corpo do POST público. */
  semearResposta(pesquisaId: number, answers: { question_id: number; score?: number; choice?: string; text?: string }[]): void {
    this.respostasRecebidas.push({ pesquisa: pesquisaId, corpo: { answers } });
    const s = this.surveys.find((x) => x.id === pesquisaId);
    if (s) s.response_count = (s.response_count ?? 0) + 1;
  }

  /** Cliente que aceitou ser contatado numa campanha NPS. */
  semearContato(pesquisaId: number, contato: { name: string; phone?: string; email?: string; score: number; comment?: string }): SurveyContact {
    const c: SurveyContact = {
      submission_id: this.proximoIdContato++, name: contato.name, phone: contato.phone ?? null, email: contato.email ?? null,
      score: contato.score, comment: contato.comment ?? null, submitted_at: agoraIso(), contacted_at: null,
    };
    this.contatosPorPesquisa.set(pesquisaId, [...(this.contatosPorPesquisa.get(pesquisaId) ?? []), c]);
    const s = this.surveys.find((x) => x.id === pesquisaId);
    if (s) s.response_count = (s.response_count ?? 0) + 1;
    return c;
  }

  /** Feedback já existente. Publicado/confirmado/revogado ganha token de 43 caracteres (formato que o app exige). */
  semearFeedback(dados: { employee_id: number; title: string; content: string; status: Feedback['status']; note?: string }): Feedback {
    const emp = this.employees.find((e) => e.id === dados.employee_id) ?? this.employees[0];
    const id = this.proximoIdFeedback++;
    const publicado = dados.status !== 'draft';
    const f: Feedback = {
      id, company_id: 1, employee_id: emp.id, created_by: 1, title: dados.title, content: dados.content,
      public_token: publicado ? `tk${id}`.padEnd(43, 'x') : null, status: dados.status,
      published_at: publicado ? agoraIso() : null, acknowledged_at: dados.status === 'acknowledged' ? agoraIso() : null,
      acknowledgment_note: dados.note ?? null, revoked_at: dados.status === 'revoked' ? agoraIso() : null,
      created_at: agoraIso(), updated_at: agoraIso(), employee_name: emp.name, employee_role_title: emp.role_title,
      employee_department_name: emp.department_name ?? null, created_by_name: 'Ana Paula RH', created_by_role: 'rh',
    };
    this.feedbacks.unshift(f);
    return f;
  }

  private publicoDe(f: Feedback): PublicFeedback {
    return {
      title: f.title, content: f.content, employee_name: f.employee_name ?? '', employee_role_title: f.employee_role_title ?? null,
      employee_department_name: f.employee_department_name ?? null, company_name: 'Escritório Exemplo', created_by_name: f.created_by_name ?? null,
      created_by_role: f.created_by_role ?? null, status: f.status === 'acknowledged' ? 'acknowledged' : 'published',
      published_at: f.published_at ?? agoraIso(), acknowledged_at: f.acknowledged_at, acknowledgment_note: f.acknowledgment_note ?? null,
    };
  }

  /** Contrato de GET /api/analytics?view=fechamento: totais do mês por colaborador; saldo do banco é o ATUAL. */
  private fechamentoDoMes(mes: string): Fechamento {
    const doMes = this.absences.filter((a) => a.status === 'aprovado' && a.start_date.startsWith(mes));
    const linhas: FechamentoLinha[] = this.employees.map((e) => {
      const minhas = doMes.filter((a) => a.employee_id === e.id);
      const soma = (tipo: Absence['type'], campo: (a: Absence) => number) => minhas.filter((a) => a.type === tipo).reduce((t, a) => t + campo(a), 0);
      return {
        employee_id: e.id, name: e.name, department_name: e.department_name ?? null, role_title: e.role_title,
        faltas_dias: soma('falta', (a) => (a.hours == null ? a.days_count : 0)), faltas_horas: soma('falta', (a) => a.hours ?? 0),
        folgas_horas: soma('folga', (a) => a.hours ?? 0), ferias_dias: soma('ferias', (a) => a.days_count),
        licencas_dias: minhas.filter((a) => a.type.startsWith('licenca')).reduce((t, a) => t + a.days_count, 0),
        banco_horas_saldo: Number(e.folga_hours),
      };
    });
    const total = (campo: keyof FechamentoLinha) => linhas.reduce((t, l) => t + Number(l[campo]), 0);
    return {
      month: mes, gerado_em: agoraIso(), saldo_referencia: 'atual', linhas,
      totais: {
        faltas_dias: total('faltas_dias'), faltas_horas: total('faltas_horas'), folgas_horas: total('folgas_horas'),
        ferias_dias: total('ferias_dias'), licencas_dias: total('licencas_dias'), banco_horas_saldo: total('banco_horas_saldo'),
      },
    };
  }

  /** Regra do contrato do PUT /api/surveys/:id: com respostas só se pode o que o front libera. */
  private bloqueiosDaEdicao(s: PulseSurvey, corpo: CorpoJson): string[] {
    if ((s.response_count ?? 0) === 0 || !Array.isArray(corpo.questions)) return [];
    const originais = [...(s.questions ?? [])].sort((a, b) => a.position - b.position);
    const novas = corpo.questions as CorpoJson[];
    const bloqueios: string[] = [];
    originais.forEach((o, i) => {
      const q = novas[i];
      if (!q || q.id !== o.id) { bloqueios.push(`A pergunta ${i + 1} não pode ser removida nem mudar de posição.`); return; }
      if (q.type !== o.type) bloqueios.push(`A pergunta ${i + 1} não pode mudar de tipo.`);
      if (q.required === true && !o.required) bloqueios.push(`A pergunta ${i + 1} não pode voltar a ser obrigatória.`);
      const antigas = o.options ?? [];
      const atuais = Array.isArray(q.options) ? (q.options as string[]) : [];
      if (o.type === 'choice' && antigas.some((op, k) => atuais[k] !== op)) bloqueios.push(`As opções que já existem na pergunta ${i + 1} não podem mudar.`);
    });
    novas.slice(originais.length).forEach((q, k) => {
      if (q.id !== undefined) bloqueios.push(`A pergunta ${originais.length + k + 1} não existe na pesquisa.`);
      if (q.required !== false) bloqueios.push(`A pergunta nova ${originais.length + k + 1} precisa ser opcional.`);
    });
    return bloqueios;
  }

  /** Resultados por pergunta, calculados com as respostas realmente recebidas. */
  private resultadosDe(s: PulseSurvey): QuestionResult[] {
    const envios = this.respostasRecebidas.filter((r) => r.pesquisa === s.id);
    return (s.questions ?? []).map((q) => {
      const respostas = envios.flatMap((e) => ((e.corpo.answers ?? []) as CorpoJson[]).filter((a) => a.question_id === q.id));
      const base: QuestionResult = { question_id: q.id, position: q.position, question: q.question, type: q.type, answered: respostas.length };
      const notas = respostas.map((a) => Number(a.score));
      if (q.type === 'scale') {
        const distribution: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        notas.forEach((n) => { distribution[String(n)] += 1; });
        return { ...base, avg: notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : undefined, distribution };
      }
      if (q.type === 'nps') {
        const distribution: Record<string, number> = {};
        for (let n = 0; n <= 10; n++) distribution[String(n)] = 0;
        notas.forEach((n) => { distribution[String(n)] += 1; });
        const promoters = notas.filter((n) => n >= 9).length;
        const detractors = notas.filter((n) => n <= 6).length;
        return { ...base, distribution, promoters, passives: notas.length - promoters - detractors, detractors, nps: notas.length ? Math.round(((promoters - detractors) * 100) / notas.length) : null };
      }
      if (q.type === 'choice') {
        const distribution: Record<string, number> = Object.fromEntries((q.options ?? []).map((o) => [o, 0]));
        respostas.forEach((a) => { distribution[String(a.choice)] = (distribution[String(a.choice)] ?? 0) + 1; });
        return { ...base, distribution };
      }
      return { ...base, texts: respostas.map((a) => String(a.text)) };
    });
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

  /** Atrasa as chamadas que casam com o padrão (ex.: `atrasar(/^/api/employees/, 2000)`). */
  atrasar(padrao: RegExp, ms: number, metodo?: string): void {
    this.atrasos.push({ metodo, padrao, ms });
  }

  /** As próximas `vezes` chamadas (metodo + padrão) respondem com erro (500 por padrão). */
  falharProximas(metodo: string, padrao: RegExp, vezes = 1, status = 500): void {
    this.falhas.push({ metodo: metodo.toUpperCase(), padrao, status, restantes: vezes });
  }

  /** Quantas vezes a chamada (método + caminho com query, comparação exata do início) já chegou. */
  contarChamadas(metodo: string, prefixo: string): number {
    return this.chamadas.filter((c) => c.startsWith(`${metodo.toUpperCase()} ${prefixo}`)).length;
  }

  async atender(route: Route, request: Request): Promise<void> {
    const url = new URL(request.url());
    const metodo = request.method().toUpperCase();
    const caminho = url.pathname;
    const consulta = url.searchParams;
    this.chamadas.push(`${metodo} ${caminho}${url.search}`);
    let corpo: CorpoJson = {};
    if (metodo !== 'GET' && metodo !== 'HEAD') {
      try {
        corpo = (request.postDataJSON() ?? {}) as CorpoJson;
      } catch {
        corpo = {};
      }
      this.escritas.push({ metodo, caminho: caminho + url.search, corpo });
    }

    const assinatura = `${metodo} ${caminho}${url.search}`;
    const responder = async (status: number, dados?: unknown): Promise<void> => {
      await route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: dados === undefined ? '' : JSON.stringify(dados),
      });
      this.concluidas.push(assinatura);
    };
    const erro = (status: number, mensagem: string) => responder(status, { error: mensagem });

    // Atraso e falha injetados pelo teste (antes de qualquer efeito no estado, como numa API lenta/instável).
    const atraso = this.atrasos.find((a) => (!a.metodo || a.metodo.toUpperCase() === metodo) && a.padrao.test(caminho + url.search));
    if (atraso) await new Promise((fim) => setTimeout(fim, atraso.ms));
    const falha = this.falhas.find((f) => f.restantes > 0 && f.metodo === metodo && f.padrao.test(caminho + url.search));
    if (falha) {
      falha.restantes -= 1;
      return erro(falha.status, 'Erro interno simulado');
    }

    // ── Rotas públicas (sem token) ──
    if (caminho === '/api/auth/login' && metodo === 'POST') {
      const usuario = String(corpo.username ?? '').trim().toLowerCase();
      if (usuario === CREDENCIAIS.usuario && corpo.password === CREDENCIAIS.senha) {
        return responder(200, { token: gerarToken(this.usuarioLogado), user: this.usuarioLogado });
      }
      if (usuario === CREDENCIAIS_OUTRO.usuario && corpo.password === CREDENCIAIS_OUTRO.senha) {
        return responder(200, { token: gerarToken(USUARIO_OUTRO), user: USUARIO_OUTRO });
      }
      return erro(401, 'Usuário ou senha incorretos');
    }

    // Feedback público (link individual do colaborador, sem login). Mesmas mensagens/status do api/feedback/_handler.ts.
    const mFbPublico = caminho.match(/^\/api\/feedback\/public\/([^/]+)(\/acknowledge)?$/);
    if (mFbPublico) {
      const f = this.feedbacks.find((x) => x.public_token === mFbPublico[1] && x.status !== 'draft');
      if (!f) return erro(404, 'Feedback não encontrado');
      if (f.status === 'revoked') return erro(410, 'Este link de feedback foi revogado');
      if (mFbPublico[2] && metodo === 'POST') {
        if (corpo.acknowledged !== true) return erro(400, 'Confirmação de leitura obrigatória');
        const jaConfirmado = f.status === 'acknowledged';
        if (!jaConfirmado) {
          f.status = 'acknowledged';
          f.acknowledged_at = agoraIso();
          f.acknowledgment_note = typeof corpo.note === 'string' ? corpo.note : null;
        }
        return responder(200, { acknowledged_at: f.acknowledged_at, already_acknowledged: jaConfirmado, acknowledgment_note: f.acknowledgment_note });
      }
      if (metodo === 'GET') return responder(200, this.publicoDe(f));
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
      // Contato só existe quando o cliente consentiu (o app só envia `contact` nesse caso).
      const contato = corpo.contact as CorpoJson | undefined;
      if (contato && contato.consent === true) {
        const respostas = (corpo.answers ?? []) as CorpoJson[];
        const nps = s?.questions?.find((q) => q.type === 'nps');
        const texto = s?.questions?.find((q) => q.type === 'text');
        this.semearContato(id, {
          name: String(contato.name ?? ''), phone: contato.phone as string | undefined, email: contato.email as string | undefined,
          score: Number(respostas.find((a) => a.question_id === nps?.id)?.score ?? 0),
          comment: respostas.find((a) => a.question_id === texto?.id)?.text as string | undefined,
        });
        if (s) s.response_count = (s.response_count ?? 1) - 1; // semearContato já contou uma; a resposta acima é a mesma
      }
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
      if (emp && nova.type === 'folga' && nova.hours) emp.folga_hours = Number(emp.folga_hours) - nova.hours;
      if (emp && nova.type === 'ferias') emp.vacation_days -= nova.days_count;
      return responder(201, nova);
    }
    const mAus = caminho.match(/^\/api\/absences\/(\d+)$/);
    if (mAus) {
      const a = this.absences.find((x) => x.id === Number(mAus[1]));
      if (!a) return erro(404, 'Ausência não encontrada');
      const dono = this.employees.find((e) => e.id === a.employee_id);
      if (metodo === 'PATCH') {
        if (typeof corpo.approved === 'boolean') { a.status = corpo.approved ? 'aprovado' : 'recusado'; return responder(200, a); }
        // Editar horas de folga APROVADA ajusta a diferença no banco de horas; acima do saldo => 422.
        if (a.status === 'aprovado' && dono && a.type === 'folga' && typeof corpo.hours === 'number') {
          const diferenca = corpo.hours - (a.hours ?? 0);
          if (diferenca > Number(dono.folga_hours)) return erro(422, `Saldo insuficiente: ${dono.name} tem ${dono.folga_hours}h disponíveis.`);
          dono.folga_hours = Number(dono.folga_hours) - diferenca;
        }
        Object.assign(a, corpo);
        return responder(200, a);
      }
      if (metodo === 'DELETE') {
        // Excluir lançamento APROVADO devolve o saldo.
        if (a.status === 'aprovado' && dono) {
          if (a.type === 'folga' && a.hours) dono.folga_hours = Number(dono.folga_hours) + a.hours;
          if (a.type === 'ferias') dono.vacation_days += a.days_count;
        }
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

    const mEvento = caminho.match(/^\/api\/events\/([^/]+)$/);
    if (mEvento) {
      const e = this.events.find((x) => x.id === mEvento[1]);
      if (!e) return erro(404, 'Evento não encontrado');
      if (metodo === 'PUT') { Object.assign(e, corpo); return responder(200, e); }
      if (metodo === 'DELETE') { this.events = this.events.filter((x) => x.id !== e.id); return responder(204); }
    }

    // Avisos, notificações, push, holerites, analytics
    if (caminho === '/api/notices' && metodo === 'GET') return responder(200, { data: this.notices, total: this.notices.length });
    if (caminho === '/api/notices' && metodo === 'POST') {
      const novo = { id: this.proximoIdAviso++, company_id: 1, author_id: 1, author_name: USUARIO_RH.name, created_at: agoraIso(), pinned: false, priority: 'normal', ...corpo } as Notice;
      this.notices.unshift(novo);
      return responder(201, novo);
    }
    const mAviso = caminho.match(/^\/api\/notices\/(\d+)$/);
    if (mAviso) {
      const n = this.notices.find((x) => x.id === Number(mAviso[1]));
      if (!n) return erro(404, 'Aviso não encontrado');
      if (metodo === 'PATCH') { Object.assign(n, corpo); return responder(200, n); }
      if (metodo === 'DELETE') { this.notices = this.notices.filter((x) => x.id !== n.id); return responder(204); }
    }

    // Notificações (a mesma rota de /api/users, com ?notifications=1)
    if (caminho === '/api/users' && consulta.get('notifications') === '1') {
      if (metodo === 'GET') return responder(200, { notifications: this.notificacoes, unread: this.notificacoes.filter((n) => !n.read).length });
      this.notificacoes.forEach((n) => { if (corpo.all === true || n.id === corpo.id) n.read = true; });
      return responder(200, { ok: true });
    }

    // Usuários (Admin)
    const consultaDeUsuarios = !consulta.get('push');
    if (caminho === '/api/users' && consultaDeUsuarios && metodo === 'GET') return responder(200, { data: this.usuarios, total: this.usuarios.length, page: 1, limit: 50, totalPages: 1 });
    if (caminho === '/api/users' && consultaDeUsuarios && metodo === 'POST') {
      const novo = { id: this.proximoIdUsuario++, company_id: 1, created_at: agoraIso(), ...corpo } as SystemUser;
      this.usuarios.push(novo);
      return responder(201, novo);
    }

    // Reconhecimentos
    if (caminho === '/api/recognitions' && metodo === 'GET') return responder(200, { data: this.recognitions, total: this.recognitions.length });
    if (caminho === '/api/recognitions' && metodo === 'POST') {
      const emp = this.employees.find((e) => e.id === Number(corpo.to_employee_id));
      const nova: Recognition = {
        id: this.proximoIdReconhecimento++, company_id: 1, from_user_id: 1, from_name: USUARIO_RH.name, to_employee_id: Number(corpo.to_employee_id),
        to_name: emp?.name ?? '', to_role: emp?.role_title, message: String(corpo.message), category: corpo.category as Recognition['category'], created_at: agoraIso(),
      };
      this.recognitions.unshift(nova);
      return responder(201, nova);
    }
    const mReconhecimento = caminho.match(/^\/api\/recognitions\/(\d+)$/);
    if (mReconhecimento && metodo === 'DELETE') {
      this.recognitions = this.recognitions.filter((r) => r.id !== Number(mReconhecimento[1]));
      return responder(204);
    }

    // Feedbacks (RH)
    if (caminho === '/api/feedbacks' && metodo === 'GET') return responder(200, this.feedbacks);
    if (caminho === '/api/feedbacks' && metodo === 'POST') {
      const f = this.semearFeedback({ employee_id: Number(corpo.employee_id), title: String(corpo.title), content: String(corpo.content), status: 'draft' });
      return responder(201, f);
    }
    const mFeedback = caminho.match(/^\/api\/feedbacks\/(\d+)(?:\/(publish|revoke))?$/);
    if (mFeedback) {
      const f = this.feedbacks.find((x) => x.id === Number(mFeedback[1]));
      if (!f) return erro(404, 'Feedback não encontrado');
      if (!mFeedback[2] && metodo === 'GET') return responder(200, f);
      if (!mFeedback[2] && metodo === 'PUT') { Object.assign(f, corpo); return responder(200, f); }
      if (!mFeedback[2] && metodo === 'DELETE') { this.feedbacks = this.feedbacks.filter((x) => x.id !== f.id); return responder(204); }
      if (mFeedback[2] === 'publish' && metodo === 'POST') {
        if (f.status !== 'draft') return erro(409, 'Feedback já foi publicado ou encerrado');
        f.status = 'published';
        f.published_at = agoraIso();
        f.public_token = `tk${f.id}`.padEnd(43, 'x');
        return responder(200, f);
      }
      if (mFeedback[2] === 'revoke' && metodo === 'POST') {
        if (f.status !== 'published' && f.status !== 'acknowledged') return erro(409, 'Somente feedback publicado pode ser revogado');
        f.status = 'revoked';
        f.revoked_at = agoraIso();
        return responder(200, f);
      }
    }

    // Onboarding
    if (caminho === '/api/onboarding' && metodo === 'GET') return responder(200, this.onboardings);
    const mOnboarding = caminho.match(/^\/api\/onboarding\/(\d+)(\/step)?$/);
    if (mOnboarding) {
      const p = this.onboardings.find((x) => x.id === Number(mOnboarding[1]));
      if (!p) return erro(404, 'Processo não encontrado');
      if (!mOnboarding[2] && metodo === 'GET') return responder(200, p);
      if (mOnboarding[2] && metodo === 'PATCH') {
        p.steps_progress[String(corpo.step_index)] = corpo.completed === true
          ? { completed: true, completed_at: agoraIso(), completed_by: USUARIO_RH.name }
          : { completed: false };
        const feitas = Object.values(p.steps_progress).filter((s) => s.completed).length;
        p.completed_at = feitas === p.steps_snapshot.length ? agoraIso() : null;
        return responder(200, p);
      }
    }

    // Assistente (IA)
    if (caminho === '/api/chat' && metodo === 'POST') {
      return this.chatIndisponivel ? erro(502, 'Assistente temporariamente indisponível. Tente novamente em instantes.') : responder(200, { message: 'Resposta simulada do assistente.' });
    }
    if (caminho === '/api/users' && consulta.get('push') === '1') return responder(200, { ok: true });
    if (caminho === '/api/payslips' && metodo === 'GET') return responder(200, []);
    if (caminho === '/api/analytics' && metodo === 'GET' && consulta.get('view') === 'fechamento') {
      const mes = consulta.get('month') ?? '';
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return erro(400, 'Mês inválido (use AAAA-MM)');
      if (this.falhasDoFechamento > 0) { this.falhasDoFechamento -= 1; return erro(500, 'Erro interno'); }
      return responder(200, this.fechamentoDoMes(mes));
    }
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
    // Retornar contato (NPS): mesma rota da pesquisa, com ?contact=<participação>.
    if (mPesquisa && consulta.get('contact')) {
      const contatos = this.contatosPorPesquisa.get(Number(mPesquisa[1])) ?? [];
      const c = contatos.find((x) => x.submission_id === Number(consulta.get('contact')));
      if (!c) return erro(404, 'Contato não encontrado');
      if (metodo === 'PATCH') { c.contacted_at = agoraIso(); return responder(200, { contacted_at: c.contacted_at }); }
      if (metodo === 'DELETE') { this.contatosPorPesquisa.set(Number(mPesquisa[1]), contatos.filter((x) => x !== c)); return responder(204); }
    }
    if (mPesquisa && metodo === 'PUT') {
      const s = this.surveys.find((x) => x.id === Number(mPesquisa[1]));
      if (!s) return erro(404, 'Pesquisa não encontrada');
      const bloqueios = this.forcarBloqueios ?? this.bloqueiosDaEdicao(s, corpo);
      if (bloqueios.length > 0) return responder(409, { error: 'Edição bloqueada: a pesquisa já tem respostas', codigo: 'edicao_bloqueada', bloqueios });
      if (typeof corpo.title === 'string') s.title = corpo.title;
      if ('expires_at' in corpo) s.expires_at = (corpo.expires_at as string | null) ?? null;
      if (Array.isArray(corpo.questions)) {
        s.questions = (corpo.questions as CorpoJson[]).map((q, i) => ({
          id: typeof q.id === 'number' ? q.id : this.proximoIdPergunta++, position: i + 1, question: String(q.question), type: q.type as SurveyQuestion['type'],
          options: Array.isArray(q.options) ? (q.options as string[]) : null, required: q.required !== false,
        }));
      }
      return responder(200, s);
    }
    if (mPesquisa && metodo === 'DELETE') {
      this.surveys = this.surveys.filter((s) => s.id !== Number(mPesquisa[1]));
      return responder(204);
    }
    const mResultados = caminho.match(/^\/api\/surveys\/(\d+)\/results$/);
    if (mResultados && metodo === 'GET') {
      const s = this.surveys.find((x) => x.id === Number(mResultados[1]));
      if (!s) return erro(404, 'Pesquisa não encontrada');
      const contacts = this.contatosPorPesquisa.get(s.id);
      return responder(200, { survey: s, total_responses: s.response_count ?? 0, questions: this.resultadosDe(s), ...(s.audience === 'customers' ? { contacts: contacts ?? [] } : {}) });
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
        // Simultaneidade medida: quantas chamadas /api/ estão em andamento ao mesmo tempo (aquecimento do cache ≤ 3 + a da tela).
        this.emAndamento += 1;
        this.picoSimultaneo = Math.max(this.picoSimultaneo, this.emAndamento);
        try { await this.atender(route, request); } finally { this.emAndamento -= 1; }
        return;
      }
      await route.continue();
    });
  }
}
