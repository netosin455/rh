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
        WHERE ps.company_id=${companyId} AND pr.submitted_at >= NOW()-INTERVAL '30 days'`.catch(() => []),
    sql`SELECT COUNT(*) FILTER (WHERE completed_at IS NULL) AS active_count,
               COUNT(*) FILTER (WHERE completed_at IS NULL AND started_at < NOW()-INTERVAL '14 days') AS overdue_count
        FROM onboarding_processes WHERE company_id=${companyId}`.catch(() => []),
    sql`SELECT COUNT(*) AS total, ROUND(AVG(response_count)::numeric,0) AS avg_responses
        FROM pulse_surveys WHERE company_id=${companyId} AND (expires_at IS NULL OR expires_at > NOW())`.catch(() => []),
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: unknown) {
    const er = e as { status?: number; message?: string };
    return err(res, er.status ?? 401, er.message ?? 'Não autorizado');
  }

  if (req.method !== 'GET') return err(res, 405, 'Método não permitido');

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
  ] = await Promise.all([

    // Distribuição por status
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM employees
      WHERE company_id = ${cid}
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
  const alerts: ProactiveAlert[] = [];

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
