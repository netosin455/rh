// ============================================================
// api/insights.ts — GET /api/insights
// Retorna insights de IA proativos (cache 6h por empresa)
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import Groq from 'groq-sdk';
import { sql, cors, authenticate, err, IS_ADMIN } from './_lib';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface Insight {
  title:        string;
  description:  string;
  severity:     'high' | 'medium' | 'low';
  action_route?: string;
}

async function fetchAnalyticsContext(companyId: number) {
  const [riskRows, absenceRow, climateRow, onboardingRows, surveyRows] = await Promise.all([
    sql`
      SELECT name, role_title, department_name,
             total_absences_90d AS absences_90d,
             turnover_risk AS risk
      FROM vw_employee_analytics
      WHERE company_id = ${companyId}
        AND status = 'ativo'
        AND turnover_risk IN ('alto', 'medio')
      ORDER BY CASE turnover_risk WHEN 'alto' THEN 0 ELSE 1 END,
               total_absences_90d DESC
      LIMIT 5
    `.catch(() => []),

    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ativo') AS active_total,
        COUNT(*) FILTER (
          WHERE status = 'ativo'
            AND id IN (
              SELECT DISTINCT employee_id FROM absences
              WHERE company_id = ${companyId}
                AND start_date >= CURRENT_DATE - INTERVAL '30 days'
            )
        ) AS absent_30d
      FROM employees
      WHERE company_id = ${companyId}
    `.catch(() => []),

    sql`
      SELECT ROUND(AVG(score)::numeric, 1) AS avg_score
      FROM pulse_responses pr
      JOIN pulse_surveys ps ON ps.id = pr.survey_id
      WHERE ps.company_id = ${companyId}
        AND pr.submitted_at >= NOW() - INTERVAL '30 days'
    `.catch(() => []),

    sql`
      SELECT COUNT(*) FILTER (WHERE NOT completed_at IS NOT NULL) AS active_count,
             COUNT(*) FILTER (
               WHERE NOT completed_at IS NOT NULL
                 AND started_at < NOW() - INTERVAL '14 days'
             ) AS overdue_count
      FROM onboarding_processes
      WHERE company_id = ${companyId}
    `.catch(() => []),

    sql`
      SELECT COUNT(*) AS total,
             ROUND(AVG(response_count)::numeric, 0) AS avg_responses
      FROM pulse_surveys
      WHERE company_id = ${companyId}
        AND (expires_at IS NULL OR expires_at > NOW())
    `.catch(() => []),
  ]);

  const active  = Number((absenceRow[0] as any)?.active_total  ?? 0);
  const absent  = Number((absenceRow[0] as any)?.absent_30d    ?? 0);
  const climate = Number((climateRow[0] as any)?.avg_score     ?? 0);
  const onbOver = Number((onboardingRows[0] as any)?.overdue_count ?? 0);
  const onbAct  = Number((onboardingRows[0] as any)?.active_count  ?? 0);

  return { riskRows, active, absent, climate, onbAct, onbOver, surveyRows };
}

async function generateInsights(companyId: number): Promise<Insight[]> {
  const { riskRows, active, absent, climate, onbAct, onbOver, surveyRows } = await fetchAnalyticsContext(companyId);

  const absenceRate = active > 0 ? Math.round((absent / active) * 100) : 0;
  const riskNames   = (riskRows as any[]).map(r => `${r.name} (${r.risk}, ${r.absences_90d} faltas/90d)`).join(', ') || 'nenhum';
  const surveyTotal = Number((surveyRows[0] as any)?.total ?? 0);
  const surveyAvg   = Number((surveyRows[0] as any)?.avg_responses ?? 0);

  const contextText = `
Dados da empresa (company_id ${companyId}):
- Colaboradores ativos: ${active}
- Taxa de ausência (30 dias): ${absenceRate}%
- Colaboradores em risco de turnover: ${(riskRows as any[]).length} — ${riskNames}
- Clima organizacional (NPS médio últimos 30d): ${climate > 0 ? climate.toFixed(1) : 'sem dados'}
- Onboardings ativos: ${onbAct}, atrasados (>14 dias): ${onbOver}
- Pesquisas de pulso abertas: ${surveyTotal}, média de respostas: ${surveyAvg}
`.trim();

  const completion = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    temperature: 0.4,
    max_tokens:  600,
    messages: [
      {
        role: 'system',
        content: `Você é um especialista em gestão de pessoas. Com base nos dados fornecidos, gere exatamente 4 insights prioritários em JSON.
Retorne APENAS um array JSON válido, sem texto extra, no formato:
[{"title":"...","description":"...","severity":"high|medium|low","action_route":"/(tabs)|/(tabs)/colaboradores|/(tabs)/ferias|/onboarding|/pesquisas"}]
Seja direto e prático. Cada description deve ter 1-2 frases objetivas.`,
      },
      { role: 'user', content: contextText },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';

  // Extrai array JSON mesmo que o modelo adicione texto ao redor
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const parsed: Insight[] = JSON.parse(match[0]);
  return parsed.filter(
    i => typeof i.title === 'string' && typeof i.description === 'string' &&
         ['high', 'medium', 'low'].includes(i.severity),
  ).slice(0, 4);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return err(res, 405, 'Método não permitido');

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  if (!IS_ADMIN.includes(ctx.role) && ctx.role !== 'rh') {
    return err(res, 403, 'Acesso restrito');
  }

  const forceRefresh = req.query.refresh === '1';

  try {
    // Busca cache válido
    if (!forceRefresh) {
      const cached = await sql`
        SELECT insights FROM ai_insights
        WHERE company_id = ${ctx.company_id}
          AND expires_at > NOW()
        ORDER BY generated_at DESC
        LIMIT 1
      `;
      if (cached.length > 0) {
        return res.status(200).json({ insights: cached[0].insights, cached: true });
      }
    }

    // Gera novos insights
    const insights = await generateInsights(ctx.company_id);

    // Salva no banco (remove expirados antes de inserir)
    await sql`
      DELETE FROM ai_insights WHERE company_id = ${ctx.company_id}
    `;
    await sql`
      INSERT INTO ai_insights (company_id, insights)
      VALUES (${ctx.company_id}, ${JSON.stringify(insights)})
    `;

    return res.status(200).json({ insights, cached: false });
  } catch (e: unknown) {
    console.error(`[${new Date().toISOString()}] [ERROR] /api/insights:`, e);
    return err(res, 500, 'Erro ao gerar insights');
  }
}
