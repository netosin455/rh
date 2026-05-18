// ============================================================
// api/chat.ts — POST /api/chat
// Assistente IA proativo powered by Groq (llama-3.3-70b)
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import Groq from 'groq-sdk';
import { sql, cors, authenticate, err } from './_lib';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Método não permitido');

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return err(res, 400, '"messages" é obrigatório');
  }

  // Contexto enriquecido em paralelo
  const [empRows, eventRows, riskRows, onboardingRows, surveyRows] = await Promise.all([

    sql`
      SELECT name, role_title, status
      FROM employees
      WHERE company_id = ${ctx.company_id} AND status != 'desligado'
      ORDER BY name LIMIT 40
    `,

    sql`
      SELECT title, date, start_time, category, location
      FROM events
      WHERE company_id = ${ctx.company_id}
        AND user_id = ${ctx.sub}
        AND date >= to_char(current_date, 'YYYY-MM-DD')
      ORDER BY date ASC, start_time ASC
      LIMIT 10
    `,

    // Colaboradores com alto risco de turnover
    sql`
      SELECT name, role_title, department_name,
        total_absences_90d AS absences_90d,
        (CURRENT_DATE - hire_date) AS days_in_company,
        turnover_risk AS risk
      FROM vw_employee_analytics
      WHERE company_id = ${ctx.company_id}
        AND status = 'ativo'
        AND turnover_risk IN ('alto', 'medio')
      ORDER BY
        CASE turnover_risk WHEN 'alto' THEN 0 ELSE 1 END,
        total_absences_90d DESC
      LIMIT 8
    `.catch((e: unknown) => {
      console.error(`[${new Date().toISOString()}] [ERROR] chat/riskRows:`, e);
      return [];
    }),

    // Onboarding em andamento
    sql`
      SELECT e.name AS employee_name, op.template_name, op.started_at,
        (
          SELECT COUNT(*) FROM jsonb_each(op.steps_progress) sp
          WHERE (sp.value->>'completed')::boolean
        )::int AS done,
        jsonb_array_length(op.steps_snapshot) AS total
      FROM onboarding_processes op
      JOIN employees e ON e.id = op.employee_id
      WHERE op.company_id = ${ctx.company_id} AND op.completed_at IS NULL
      LIMIT 6
    `.catch((e: unknown) => {
      console.error(`[${new Date().toISOString()}] [ERROR] chat/onboardingRows:`, e);
      return [];
    }),

    // Pesquisas de pulso recentes com resultados
    sql`
      SELECT ps.title, ps.question, ps.type,
        COUNT(pr.id)::int AS responses,
        ROUND(AVG(pr.score), 1) AS avg_score
      FROM pulse_surveys ps
      LEFT JOIN pulse_responses pr ON pr.survey_id = ps.id
      WHERE ps.company_id = ${ctx.company_id}
        AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
      GROUP BY ps.id, ps.title, ps.question, ps.type
      ORDER BY ps.created_at DESC
      LIMIT 4
    `.catch((e: unknown) => {
      console.error(`[${new Date().toISOString()}] [ERROR] chat/surveyRows:`, e);
      return [];
    }),
  ]);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const statusSummary = (['ativo', 'ferias', 'licenca', 'afastado'] as const)
    .map(s => `${s}: ${(empRows as any[]).filter((e: any) => e.status === s).length}`)
    .join(' · ');

  const riskSection = (riskRows as any[]).length > 0
    ? `\n=== RISCO DE TURNOVER ===\n` +
      (riskRows as any[]).map((r: any) =>
        `- [${r.risk.toUpperCase()}] ${r.name} | ${r.role_title}${r.department_name ? ` | ${r.department_name}` : ''} | ${r.absences_90d} faltas/90d | ${r.days_in_company}d na empresa`
      ).join('\n')
    : '';

  const onboardingSection = (onboardingRows as any[]).length > 0
    ? `\n=== ONBOARDING EM ANDAMENTO ===\n` +
      (onboardingRows as any[]).map((r: any) => {
        const daysSince = Math.floor((Date.now() - new Date(r.started_at).getTime()) / 86400000);
        return `- ${r.employee_name}: ${r.done}/${r.total} etapas | ${daysSince}d em andamento`;
      }).join('\n')
    : '';

  const surveySection = (surveyRows as any[]).length > 0
    ? `\n=== PESQUISAS DE PULSO ATIVAS ===\n` +
      (surveyRows as any[]).map((r: any) =>
        `- "${r.title}": ${r.responses} resposta${r.responses !== 1 ? 's' : ''}${r.avg_score ? ` · média ${r.avg_score}/5${Number(r.avg_score) < 3 ? ' ⚠️ BAIXO' : ''}` : ''}`
      ).join('\n')
    : '';

  const systemPrompt = `Você é o assistente de RH do SuperRH, especialista em gestão de pessoas.
Responda sempre em português brasileiro, de forma concisa e profissional.
Seja proativo: ao identificar riscos ou oportunidades nos dados, mencione-os com sugestões concretas de ação.
Hoje é ${today}. Usuário: ${ctx.name} (${ctx.role}).

=== EQUIPE (${(empRows as any[]).length} colaboradores) ===
Distribuição: ${statusSummary}

${(empRows as any[]).map((e: any) => `- ${e.name} | ${e.role_title} | ${e.status}`).join('\n')}

=== PRÓXIMOS EVENTOS (${(eventRows as any[]).length}) ===
${(eventRows as any[]).map((e: any) => `- ${e.date}${e.start_time ? ` ${e.start_time}` : ''} | ${e.title}${e.location ? ` @ ${e.location}` : ''}`).join('\n') || 'Nenhum evento próximo'}
${riskSection}${onboardingSection}${surveySection}

Você pode responder perguntas sobre colaboradores, agenda, onboarding, pesquisas e RH.
Para criar ou modificar dados, oriente o usuário a usar as telas do app.
Quando identificar riscos (alto turnover, atraso no onboarding, score baixo em pesquisa), sugira ações preventivas específicas.`;

  const VALID_ROLES = ['user', 'assistant'];
  const sanitizedMessages = messages
    .filter((m: any) => VALID_ROLES.includes(m.role) && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));

  if (sanitizedMessages.length === 0) {
    return err(res, 400, 'Nenhuma mensagem válida encontrada');
  }

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...sanitizedMessages,
      ],
      temperature: 0.5,
      max_tokens: 900,
    });
  } catch {
    return err(res, 502, 'Assistente temporariamente indisponível. Tente novamente em instantes.');
  }

  const reply = completion.choices[0]?.message?.content ?? 'Não consegui gerar uma resposta.';
  return res.json({ message: reply });
}
