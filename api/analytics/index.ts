// ============================================================
// api/analytics/index.ts — GET /api/analytics
// Retorna métricas consolidadas + alertas proativos de IA
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import Groq from 'groq-sdk';
import { sql, cors, authenticate, err, IS_ADMIN } from '../_lib';
import type {
  ProactiveAlert, EmployeeAtRisk, DeptHeadcount, ClimateHistory,
} from '../../tipos/modelos';

export const DIAS_EXPERIENCIA_INICIAL = 45;
export const DIAS_EXPERIENCIA_FINAL = 90;
export const JANELA_ALERTA_EXPERIENCIA_DIAS = 10;
export const LIMIAR_BANCO_HORAS_ALTO = 40;
export const LIMIAR_FALTAS_RECENTES = 2;
const LIMITE_NOMES_ALERTA = 3;

type AnalyticsAlert = Omit<ProactiveAlert, 'type'> & {
  type: ProactiveAlert['type'] | 'experiencia_acabando' | 'banco_horas_alto' | 'faltas_recentes';
};

// ── GET /api/analytics?view=insights — IA Insights ────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Insight {
  title:        string;
  description:  string;
  severity:     'high' | 'medium' | 'low';
  action_route?: string;
}

async function handleInsights(companyId: number, forceRefresh: boolean, res: VercelResponse) {
  if (!forceRefresh) {
    const cached = await sql`
      SELECT insights FROM ai_insights
      WHERE company_id = ${companyId} AND expires_at > NOW()
      ORDER BY generated_at DESC LIMIT 1
    `;
    if (cached.length > 0) return res.status(200).json({ insights: cached[0].insights, cached: true });
  }

  const [riskRows, absRow, climateRow, onbRow, surveyRow] = await Promise.all([
    sql`SELECT name, role_title, total_absences_90d AS absences_90d, turnover_risk AS risk
        FROM vw_employee_analytics
        WHERE company_id = ${companyId} AND status = 'ativo' AND turnover_risk IN ('alto','medio')
        ORDER BY CASE turnover_risk WHEN 'alto' THEN 0 ELSE 1 END, total_absences_90d DESC LIMIT 5`.catch(() => []),
    sql`SELECT COUNT(*) FILTER (WHERE status='ativo') AS active_total,
               COUNT(*) FILTER (WHERE status='ativo' AND id IN (
                 SELECT DISTINCT employee_id FROM absences
                 WHERE company_id=${companyId} AND start_date >= CURRENT_DATE - INTERVAL '30 days'
               )) AS absent_30d FROM employees WHERE company_id=${companyId}`.catch(() => []),
    sql`SELECT ROUND(AVG(score)::numeric,1) AS avg_score FROM pulse_responses pr
        JOIN pulse_surveys ps ON ps.id=pr.survey_id
        WHERE ps.company_id=${companyId} AND pr.responded_at >= NOW()-INTERVAL '30 days'`.catch(() => []),
    sql`SELECT COUNT(*) FILTER (WHERE completed_at IS NULL) AS active_count,
               COUNT(*) FILTER (WHERE completed_at IS NULL AND started_at < NOW()-INTERVAL '14 days') AS overdue_count
        FROM onboarding_processes WHERE company_id=${companyId}`.catch(() => []),
    // pulse_surveys não tem coluna response_count: conta via subquery em pulse_responses.
    sql`SELECT COUNT(*) AS total, ROUND(AVG(resp_count)::numeric,0) AS avg_responses
        FROM (
          SELECT ps.id, (SELECT COUNT(*) FROM pulse_responses pr WHERE pr.survey_id = ps.id) AS resp_count
          FROM pulse_surveys ps
          WHERE ps.company_id = ${companyId} AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
        ) sub`.catch(() => []),
  ]);

  const active  = Number((absRow[0] as any)?.active_total ?? 0);
  const absent  = Number((absRow[0] as any)?.absent_30d ?? 0);
  const climate = Number((climateRow[0] as any)?.avg_score ?? 0);
  const onbOver = Number((onbRow[0] as any)?.overdue_count ?? 0);
  const riskNames = (riskRows as any[]).map(r => `${r.name} (${r.risk})`).join(', ') || 'nenhum';

  const context = `Colaboradores ativos: ${active}, ausências 30d: ${absent}, taxa: ${active > 0 ? Math.round((absent/active)*100) : 0}%
Risco de turnover: ${(riskRows as any[]).length} — ${riskNames}
Clima (NPS 30d): ${climate > 0 ? climate.toFixed(1) : 'sem dados'}
Onboardings ativos: ${Number((onbRow[0] as any)?.active_count ?? 0)}, atrasados: ${onbOver}
Pesquisas abertas: ${Number((surveyRow[0] as any)?.total ?? 0)}, média respostas: ${Number((surveyRow[0] as any)?.avg_responses ?? 0)}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile', temperature: 0.4, max_tokens: 600,
    messages: [
      { role: 'system', content: 'Gere exatamente 4 insights prioritários em JSON. Retorne APENAS um array JSON: [{"title":"...","description":"...","severity":"high|medium|low","action_route":"/(tabs)|/(tabs)/colaboradores|/(tabs)/ferias|/onboarding|/pesquisas"}]' },
      { role: 'user', content: context },
    ],
  });

  const raw   = completion.choices[0]?.message?.content?.trim() ?? '[]';
  const match = raw.match(/\[[\s\S]*\]/);
  const insights: Insight[] = match ? (JSON.parse(match[0]) as Insight[]).filter(
    i => typeof i.title === 'string' && ['high','medium','low'].includes(i.severity),
  ).slice(0, 4) : [];

  await sql`DELETE FROM ai_insights WHERE company_id = ${companyId}`;
  await sql`INSERT INTO ai_insights (company_id, insights) VALUES (${companyId}, ${JSON.stringify(insights)})`;

  return res.status(200).json({ insights, cached: false });
}

// Tipos locais para as linhas retornadas pelo banco
interface StatusRow    { status: string; count: number }
interface AbsRow       { total_days: number; active_count: number }
interface RiskRow      { risk: string; count: number; employees: EmployeeAtRisk[] }
interface CaseRow      { id: number; case_number: string; title: string; area: string; deadline: string | null; responsible_name: string | null }
interface OnboardRow   { active: number; long_running: number }
interface ClimateRow   { month: string; avg_score: number; response_count: number }
interface ClosingRow {
  employee_id: number;
  name: string;
  department_name: string;
  role_title: string;
  faltas_dias: number | string;
  faltas_horas: number | string;
  folgas_horas: number | string;
  ferias_dias: number | string;
  licencas_dias: number | string;
  banco_horas_saldo: number | string;
}
interface ExperienceAlertRow { id: number; name: string; marco: number | string; dias_restantes: number | string }
interface BankHoursAlertRow { id: number; name: string; folga_hours: number | string }
interface RecentAbsenceAlertRow { id: number; name: string; faltas: number | string }

type ClosingLine = {
  employee_id: number;
  name: string;
  department_name: string;
  role_title: string;
  faltas_dias: number;
  faltas_horas: number;
  folgas_horas: number;
  ferias_dias: number;
  licencas_dias: number;
  banco_horas_saldo: number;
};

type ClosingTotals = Omit<ClosingLine, 'employee_id' | 'name' | 'department_name' | 'role_title'>;

function parseClosingMonth(value: unknown): string | null {
  return typeof value === 'string' && /^(?:[1-9]\d{3})-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

function numericValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function singularOrPlural(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function alertRoute(rows: readonly { id: number }[]): string {
  return rows.length === 1 ? `colaborador/${rows[0].id}` : 'colaboradores';
}

function alertNames<T>(rows: readonly T[], format: (row: T) => string): string {
  const names = rows.slice(0, LIMITE_NOMES_ALERTA).map(format).join(', ');
  const extra = rows.length - LIMITE_NOMES_ALERTA;
  return extra > 0 ? `${names} +${extra}` : names;
}

export function buildExperienceAlert(rows: readonly ExperienceAlertRow[]): AnalyticsAlert | null {
  const upcoming = rows.filter((row) => {
    const remainingDays = numericValue(row.dias_restantes);
    return remainingDays >= 0 && remainingDays <= JANELA_ALERTA_EXPERIENCIA_DIAS;
  });
  if (!upcoming.length) return null;
  const severity = upcoming.some((row) => numericValue(row.dias_restantes) <= 3) ? 'alta' : 'media';
  return {
    type: 'experiencia_acabando',
    severity,
    title: `${upcoming.length} ${singularOrPlural(upcoming.length, 'contrato', 'contratos')} de experiência ${singularOrPlural(upcoming.length, 'termina', 'terminam')} nos próximos ${JANELA_ALERTA_EXPERIENCIA_DIAS} dias`,
    description: alertNames(upcoming, (row) => {
      const days = numericValue(row.dias_restantes);
      return `${row.name} (${numericValue(row.marco)} dias em ${days} ${singularOrPlural(days, 'dia', 'dias')})`;
    }),
    route: alertRoute(upcoming),
    icon: 'hourglass-outline',
  };
}

export function buildHighBankHoursAlert(rows: readonly BankHoursAlertRow[]): AnalyticsAlert | null {
  const highBalance = rows.filter((row) => numericValue(row.folga_hours) >= LIMIAR_BANCO_HORAS_ALTO);
  if (!highBalance.length) return null;
  return {
    type: 'banco_horas_alto',
    severity: 'media',
    title: `${highBalance.length} ${singularOrPlural(highBalance.length, 'colaborador com banco de horas alto', 'colaboradores com banco de horas alto')}`,
    description: alertNames(highBalance, (row) => `${row.name} (${numericValue(row.folga_hours)}h)`),
    route: alertRoute(highBalance),
    icon: 'time-outline',
  };
}

export function buildRecentAbsencesAlert(rows: readonly RecentAbsenceAlertRow[]): AnalyticsAlert | null {
  const recurringAbsences = rows.filter((row) => numericValue(row.faltas) >= LIMIAR_FALTAS_RECENTES);
  if (!recurringAbsences.length) return null;
  return {
    type: 'faltas_recentes',
    severity: 'media',
    title: `${recurringAbsences.length} ${singularOrPlural(recurringAbsences.length, 'colaborador com faltas recentes', 'colaboradores com faltas recentes')}`,
    description: alertNames(recurringAbsences, (row) => {
      const count = numericValue(row.faltas);
      return `${row.name} (${count} ${singularOrPlural(count, 'falta', 'faltas')})`;
    }),
    route: alertRoute(recurringAbsences),
    icon: 'alert-circle-outline',
  };
}

async function handleMonthClosing(companyId: number, month: string, res: VercelResponse) {
  const rows = await sql`
    WITH periodo AS (
      SELECT
        TO_DATE(${month} || '-01', 'YYYY-MM-DD') AS inicio,
        (DATE_TRUNC('month', TO_DATE(${month} || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month - 1 day')::date AS fim
    ), equipe AS (
      SELECT
        e.id AS employee_id,
        e.name,
        COALESCE(d.name, 'Sem departamento') AS department_name,
        e.role_title,
        e.folga_hours AS banco_horas_saldo
      FROM employees e
      CROSS JOIN periodo p
      LEFT JOIN departments d ON d.id = e.department_id AND d.company_id = e.company_id
      WHERE e.company_id = ${companyId}
        AND e.deleted_at IS NULL
        AND e.hire_date <= p.fim
        AND e.status <> 'desligado'
    )
    SELECT
      eq.employee_id,
      eq.name,
      eq.department_name,
      eq.role_title,
      COALESCE(SUM(CASE
        WHEN a.type = 'falta' AND a.hours IS NULL
        THEN LEAST(a.end_date, p.fim) - GREATEST(a.start_date, p.inicio) + 1
        ELSE 0
      END), 0)::int AS faltas_dias,
      COALESCE(SUM(CASE
        WHEN a.type = 'falta' AND a.hours IS NOT NULL THEN a.hours
        ELSE 0
      END), 0)::numeric AS faltas_horas,
      COALESCE(SUM(CASE
        WHEN a.type = 'folga' AND a.hours IS NOT NULL THEN a.hours
        ELSE 0
      END), 0)::numeric AS folgas_horas,
      COALESCE(SUM(CASE
        WHEN a.type = 'ferias'
        THEN LEAST(a.end_date, p.fim) - GREATEST(a.start_date, p.inicio) + 1
        ELSE 0
      END), 0)::int AS ferias_dias,
      COALESCE(SUM(CASE
        WHEN a.type IN ('licenca_medica', 'licenca_maternidade', 'licenca_paternidade')
        THEN LEAST(a.end_date, p.fim) - GREATEST(a.start_date, p.inicio) + 1
        ELSE 0
      END), 0)::int AS licencas_dias,
      eq.banco_horas_saldo
    FROM equipe eq
    CROSS JOIN periodo p
    LEFT JOIN absences a ON a.employee_id = eq.employee_id
      AND a.company_id = ${companyId}
      AND a.status = 'aprovado'
      AND a.start_date <= p.fim
      AND a.end_date >= p.inicio
    GROUP BY eq.employee_id, eq.name, eq.department_name, eq.role_title, eq.banco_horas_saldo
    ORDER BY eq.name
  `;

  const linhas: ClosingLine[] = (rows as ClosingRow[]).map((row) => ({
    employee_id: numericValue(row.employee_id),
    name: row.name,
    department_name: row.department_name,
    role_title: row.role_title,
    faltas_dias: numericValue(row.faltas_dias),
    faltas_horas: numericValue(row.faltas_horas),
    folgas_horas: numericValue(row.folgas_horas),
    ferias_dias: numericValue(row.ferias_dias),
    licencas_dias: numericValue(row.licencas_dias),
    banco_horas_saldo: numericValue(row.banco_horas_saldo),
  }));
  const totais = linhas.reduce<ClosingTotals>((total, line) => ({
    faltas_dias: total.faltas_dias + line.faltas_dias,
    faltas_horas: total.faltas_horas + line.faltas_horas,
    folgas_horas: total.folgas_horas + line.folgas_horas,
    ferias_dias: total.ferias_dias + line.ferias_dias,
    licencas_dias: total.licencas_dias + line.licencas_dias,
    banco_horas_saldo: total.banco_horas_saldo + line.banco_horas_saldo,
  }), {
    faltas_dias: 0,
    faltas_horas: 0,
    folgas_horas: 0,
    ferias_dias: 0,
    licencas_dias: 0,
    banco_horas_saldo: 0,
  });

  // "outro" não é licença e folga sem horas legada vale zero; o saldo não possui histórico mensal.
  return res.json({ month, gerado_em: new Date().toISOString(), saldo_referencia: 'atual', linhas, totais });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: unknown) {
    const er = e as { status?: number; message?: string };
    return err(res, er.status ?? 401, er.message ?? 'Não autorizado');
  }

  if (req.method !== 'GET') return err(res, 405, 'Método não permitido');

  // Fechamento mensal: GET /api/analytics?view=fechamento&month=YYYY-MM
  if (req.query.view === 'fechamento') {
    if (!IS_ADMIN.includes(ctx.role) && ctx.role !== 'rh') return err(res, 403, 'Acesso restrito');
    const month = parseClosingMonth(req.query.month);
    if (!month) return err(res, 400, 'month deve usar o formato YYYY-MM');
    try {
      return await handleMonthClosing(ctx.company_id, month, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      console.error(`[${new Date().toISOString()}] [ERROR] analytics/fechamento`, { company_id: ctx.company_id, message });
      return err(res, 500, 'Erro ao gerar fechamento mensal');
    }
  }

  // Rota de insights: GET /api/analytics?view=insights
  if (req.query.view === 'insights') {
    if (!IS_ADMIN.includes(ctx.role) && ctx.role !== 'rh') return err(res, 403, 'Acesso restrito');
    try {
      return await handleInsights(ctx.company_id, req.query.refresh === '1', res);
    } catch (e: unknown) {
      console.error(`[${new Date().toISOString()}] [ERROR] analytics/insights:`, e);
      return err(res, 500, 'Erro ao gerar insights');
    }
  }

  const cid = ctx.company_id;

  const [
    statusDist,
    deptHeadcount,
    absenteeismCurrent,
    absenteeismPrev,
    turnoverRisk,
    urgentCases,
    onboardingStats,
    climateHistory,
    experienceEnding,
    highBankHours,
    recentAbsences,
  ] = await Promise.all([

    // Distribuição por status (calculado ao vivo a partir de ausências aprovadas,
    // mesma lógica de api/employees/index.ts — evita divergir do Dashboard/Equipe)
    sql`
      SELECT status, COUNT(*)::int AS count FROM (
        SELECT
          CASE
            WHEN e.status IN ('desligado', 'afastado') THEN e.status
            WHEN EXISTS (
              SELECT 1 FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type = 'ferias'
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
            ) THEN 'ferias'
            WHEN EXISTS (
              SELECT 1 FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type IN ('licenca_medica','licenca_maternidade','licenca_paternidade')
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
            ) THEN 'licenca'
            ELSE 'ativo'
          END AS status
        FROM employees e
        WHERE e.company_id = ${cid} AND e.deleted_at IS NULL
      ) t
      GROUP BY status
      ORDER BY count DESC
    `,

    // Headcount por departamento (excl. desligados)
    sql`
      SELECT
        COALESCE(d.name, 'Sem departamento') AS department,
        COUNT(*)::int AS count
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.company_id = ${cid}
        AND e.status != 'desligado'
      GROUP BY d.name
      ORDER BY count DESC
    `,

    // Absenteísmo mês atual
    sql`
      SELECT
        COALESCE(SUM(a.days_count), 0)::int AS total_days,
        (SELECT COUNT(*)::int FROM employees
         WHERE company_id = ${cid} AND status = 'ativo') AS active_count
      FROM absences a
      WHERE a.company_id = ${cid}
        AND a.status = 'aprovado'
        AND a.start_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND a.start_date <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `,

    // Absenteísmo mês anterior
    sql`
      SELECT
        COALESCE(SUM(a.days_count), 0)::int AS total_days,
        (SELECT COUNT(*)::int FROM employees
         WHERE company_id = ${cid} AND status = 'ativo') AS active_count
      FROM absences a
      WHERE a.company_id = ${cid}
        AND a.status = 'aprovado'
        AND a.start_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        AND a.start_date <  DATE_TRUNC('month', CURRENT_DATE)
    `,

    // Risco de turnover via view (com engajamento)
    sql`
      SELECT
        turnover_risk AS risk,
        COUNT(*)::int AS count,
        json_agg(json_build_object(
          'id',               id,
          'name',             name,
          'department_name',  department_name,
          'role_title',       role_title,
          'days_in_company',  days_in_company,
          'absences_90d',     total_absences_90d,
          'avg_pulse_score',  avg_pulse_score
        ) ORDER BY total_absences_90d DESC, days_in_company ASC) AS employees
      FROM vw_employee_analytics
      WHERE company_id = ${cid}
        AND status != 'desligado'
      GROUP BY turnover_risk
    `,

    // Processos jurídicos urgentes
    sql`
      SELECT
        lc.id,
        lc.case_number,
        lc.title,
        lc.area,
        lc.deadline,
        e.name AS responsible_name
      FROM legal_cases lc
      LEFT JOIN employees e ON e.id = lc.responsible_id
      WHERE lc.company_id = ${cid}
        AND lc.status = 'urgente'
      ORDER BY lc.deadline ASC NULLS LAST
      LIMIT 10
    `,

    // Onboarding em andamento
    sql`
      SELECT
        COUNT(*)::int AS active,
        COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '14 days')::int AS long_running
      FROM onboarding_processes
      WHERE company_id = ${cid} AND completed_at IS NULL
    `.catch(() => [{ active: 0, long_running: 0 }]),

    // Histórico de clima organizacional (últimos 6 meses)
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', pr.responded_at), 'YYYY-MM') AS month,
        ROUND(AVG(pr.score::numeric), 2)::float                   AS avg_score,
        COUNT(*)::int                                              AS response_count
      FROM pulse_responses pr
      JOIN pulse_surveys ps ON ps.id = pr.survey_id AND ps.type = 'scale'
      WHERE ps.company_id = ${cid}
        AND pr.responded_at >= NOW() - INTERVAL '6 months'
        AND pr.score IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `.catch(() => [] as ClimateRow[]),

    // Contratos de experiência que chegam ao marco de 45 ou 90 dias na próxima janela.
    sql`
      WITH hoje AS (
        SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS data_referencia
      )
      SELECT
        e.id,
        e.name,
        CASE
          WHEN e.hire_date + ${DIAS_EXPERIENCIA_INICIAL}::int BETWEEN hoje.data_referencia AND hoje.data_referencia + ${JANELA_ALERTA_EXPERIENCIA_DIAS}::int
          THEN ${DIAS_EXPERIENCIA_INICIAL}::int
          ELSE ${DIAS_EXPERIENCIA_FINAL}::int
        END AS marco,
        CASE
          WHEN e.hire_date + ${DIAS_EXPERIENCIA_INICIAL}::int BETWEEN hoje.data_referencia AND hoje.data_referencia + ${JANELA_ALERTA_EXPERIENCIA_DIAS}::int
          THEN e.hire_date + ${DIAS_EXPERIENCIA_INICIAL}::int - hoje.data_referencia
          ELSE e.hire_date + ${DIAS_EXPERIENCIA_FINAL}::int - hoje.data_referencia
        END AS dias_restantes
      FROM employees e
      CROSS JOIN hoje
      WHERE e.company_id = ${cid}
        AND e.deleted_at IS NULL
        AND e.status = 'ativo'
        AND (
          e.hire_date + ${DIAS_EXPERIENCIA_INICIAL}::int BETWEEN hoje.data_referencia AND hoje.data_referencia + ${JANELA_ALERTA_EXPERIENCIA_DIAS}::int
          OR e.hire_date + ${DIAS_EXPERIENCIA_FINAL}::int BETWEEN hoje.data_referencia AND hoje.data_referencia + ${JANELA_ALERTA_EXPERIENCIA_DIAS}::int
        )
      ORDER BY dias_restantes, e.name
    `,

    // O saldo é atual, pois ainda não existe histórico de banco de horas por competência.
    sql`
      SELECT e.id, e.name, e.folga_hours
      FROM employees e
      WHERE e.company_id = ${cid}
        AND e.deleted_at IS NULL
        AND e.status = 'ativo'
        AND e.folga_hours >= ${LIMIAR_BANCO_HORAS_ALTO}
      ORDER BY e.folga_hours DESC, e.name
    `,

    // Hoje local evita deslocar a janela de sete dias na virada de UTC.
    sql`
      WITH hoje AS (
        SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS data_referencia
      )
      SELECT e.id, e.name, COUNT(*)::int AS faltas
      FROM employees e
      JOIN absences a ON a.employee_id = e.id AND a.company_id = e.company_id
      CROSS JOIN hoje
      WHERE e.company_id = ${cid}
        AND e.deleted_at IS NULL
        AND e.status = 'ativo'
        AND a.status = 'aprovado'
        AND a.type = 'falta'
        AND a.start_date BETWEEN hoje.data_referencia - 6 AND hoje.data_referencia
      GROUP BY e.id, e.name
      HAVING COUNT(*) >= ${LIMIAR_FALTAS_RECENTES}
      ORDER BY faltas DESC, e.name
    `,
  ]);

  const rows        = statusDist  as StatusRow[];
  const total       = rows.reduce((s, r) => s + r.count, 0);
  const statusMap   = Object.fromEntries(rows.map(r => [r.status, r.count]));

  const BUSINESS_DAYS = 22;
  const buildAbsenteeism = (row: AbsRow | undefined) => {
    const days   = row?.total_days   ?? 0;
    const active = row?.active_count ?? 1;
    const pct    = active > 0 ? Math.round((days / (active * BUSINESS_DAYS)) * 100 * 10) / 10 : 0;
    return { days, pct };
  };

  const riskMap: Record<string, { count: number; employees: EmployeeAtRisk[] }> = {
    alto:  { count: 0, employees: [] },
    medio: { count: 0, employees: [] },
    baixo: { count: 0, employees: [] },
  };
  for (const row of turnoverRisk as RiskRow[]) {
    riskMap[row.risk] = { count: row.count, employees: row.employees ?? [] };
  }

  const currAbs = buildAbsenteeism((absenteeismCurrent as AbsRow[])[0]);
  const ob      = ((onboardingStats as OnboardRow[])[0]) ?? { active: 0, long_running: 0 };
  const ucList  = urgentCases as CaseRow[];

  // Geração de alertas proativos
  const alerts: AnalyticsAlert[] = [];

  if (riskMap.alto.count > 0) {
    const names = riskMap.alto.employees.slice(0, 2).map(e => e.name).join(', ');
    const extra = riskMap.alto.count > 2 ? ` +${riskMap.alto.count - 2}` : '';
    alerts.push({
      type:        'turnover_risk',
      severity:    'alta',
      title:       `${riskMap.alto.count} colaborador${riskMap.alto.count > 1 ? 'es' : ''} com alto risco de saída`,
      description: names + extra,
      route:       'analytics',
      icon:        'warning-outline',
    });
  }

  if (currAbs.pct >= 5) {
    alerts.push({
      type:        'absenteeism',
      severity:    currAbs.pct >= 8 ? 'alta' : 'media',
      title:       `Absenteísmo ${currAbs.pct}% este mês`,
      description: `${currAbs.days} dias de ausência registrados · meta: <5%`,
      route:       'analytics',
      icon:        'trending-up-outline',
    });
  }

  if (ucList.length > 0) {
    alerts.push({
      type:        'juridico',
      severity:    'alta',
      title:       `${ucList.length} processo${ucList.length > 1 ? 's' : ''} jurídico${ucList.length > 1 ? 's' : ''} urgente${ucList.length > 1 ? 's' : ''}`,
      description: ucList[0]?.title ?? '',
      route:       'analytics',
      icon:        'briefcase-outline',
    });
  }

  if (ob.long_running > 0) {
    alerts.push({
      type:        'onboarding',
      severity:    'media',
      title:       `${ob.long_running} onboarding${ob.long_running > 1 ? 's' : ''} há mais de 14 dias`,
      description: 'Verifique o progresso das etapas pendentes',
      route:       'onboarding',
      icon:        'clipboard-outline',
    });
  }

  const experienceAlert = buildExperienceAlert(experienceEnding as ExperienceAlertRow[]);
  if (experienceAlert) alerts.push(experienceAlert);

  const bankHoursAlert = buildHighBankHoursAlert(highBankHours as BankHoursAlertRow[]);
  if (bankHoursAlert) alerts.push(bankHoursAlert);

  const recentAbsencesAlert = buildRecentAbsencesAlert(recentAbsences as RecentAbsenceAlertRow[]);
  if (recentAbsencesAlert) alerts.push(recentAbsencesAlert);

  return res.json({
    summary: {
      total,
      ativo:     statusMap['ativo']     ?? 0,
      ferias:    statusMap['ferias']    ?? 0,
      licenca:   statusMap['licenca']   ?? 0,
      afastado:  statusMap['afastado']  ?? 0,
      desligado: statusMap['desligado'] ?? 0,
    },
    headcount_by_dept:  deptHeadcount as DeptHeadcount[],
    absenteeism: {
      current: currAbs,
      prev:    buildAbsenteeism((absenteeismPrev as AbsRow[])[0]),
    },
    turnover_risk:  riskMap,
    urgent_cases:   ucList,
    climate_history: climateHistory as ClimateRow[],
    alerts,
  });
}
