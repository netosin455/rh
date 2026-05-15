// ============================================================
// api/analytics/index.ts — GET /api/analytics
// Retorna métricas consolidadas + alertas proativos de IA
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';
import type {
  ProactiveAlert, EmployeeAtRisk, DeptHeadcount, ClimateHistory,
} from '../../tipos/modelos';

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
