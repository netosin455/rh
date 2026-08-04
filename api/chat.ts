// ============================================================
// api/chat.ts — POST /api/chat
// Assistente IA proativo powered by Groq (llama-3.3-70b)
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import Groq from 'groq-sdk';
import {
  sql, cors, authenticate, err,
  CAN_APPROVE_ABSENCES, ABSENCE_VALID_TYPES,
  createAbsenceRecord, resolveAbsenceApproval,
} from './_lib';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Ferramentas que o assistente pode executar diretamente no chat.
// Escopo deliberadamente restrito a férias/ausências — nada de salário,
// desligamento ou exclusão de colaborador via linguagem natural.
const ABSENCE_TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'criar_ausencia',
      description: 'Registra férias, licença, folga ou falta para um colaborador. Já entra aprovada (quem está pedindo é RH/gestor confirmando o fato), descontando o saldo automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          employee_id: { type: 'number', description: 'ID do colaborador (use o [ID] listado no contexto da equipe)' },
          type: { type: 'string', enum: ABSENCE_VALID_TYPES, description: 'Tipo de ausência' },
          start_date: { type: 'string', description: 'Data de início, formato YYYY-MM-DD' },
          end_date: { type: 'string', description: 'Data de fim, formato YYYY-MM-DD' },
          reason: { type: 'string', description: 'Motivo/observação (opcional)' },
          hours: { type: 'number', description: 'Só pra type=folga: horas a descontar do banco de horas (opcional, deixe de fora pra contar em dias)' },
        },
        required: ['employee_id', 'type', 'start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_ausencias_pendentes',
      description: 'Lista as solicitações de férias/ausência aguardando aprovação, com seus IDs.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aprovar_ausencia',
      description: 'Aprova ou recusa uma solicitação de ausência pendente pelo ID.',
      parameters: {
        type: 'object',
        properties: {
          absence_id: { type: 'number', description: 'ID da solicitação (ver listar_ausencias_pendentes)' },
          aprovar: { type: 'boolean', description: 'true para aprovar, false para recusar' },
        },
        required: ['absence_id', 'aprovar'],
      },
    },
  },
];

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
      SELECT e.id, e.name, e.role_title,
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
      WHERE e.company_id = ${ctx.company_id} AND e.deleted_at IS NULL AND e.status != 'desligado'
      ORDER BY e.name LIMIT 40
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

  // Só quem já pode aprovar férias/ausências na tela consegue executar ações pelo chat
  const canAct = CAN_APPROVE_ABSENCES.includes(ctx.role);

  const actionInstructions = canAct
    ? `Você PODE executar ações diretamente usando as ferramentas disponíveis: registrar férias/licença/folga/falta (criar_ausencia), listar pendentes (listar_ausencias_pendentes) e aprovar/recusar (aprovar_ausencia). Use o [ID] listado na equipe para identificar o colaborador certo. Se não tiver certeza de qual colaborador o usuário quer dizer, pergunte antes de agir. Após executar uma ação, confirme em uma frase o que foi feito. Você NÃO tem ferramentas para alterar salário, desligar ou excluir colaborador — se pedirem isso, oriente a usar as telas do app.`
    : `Para criar ou modificar dados, oriente o usuário a usar as telas do app — você não tem permissão de executar ações com o cargo atual.`;

  const systemPrompt = `Você é o assistente de RH do SuperRH, especialista em gestão de pessoas.
Responda sempre em português brasileiro, de forma concisa e profissional.
Seja proativo: ao identificar riscos ou oportunidades nos dados, mencione-os com sugestões concretas de ação.
Hoje é ${today}. Usuário: ${ctx.name} (${ctx.role}).

=== EQUIPE (${(empRows as any[]).length} colaboradores) ===
Distribuição: ${statusSummary}

${(empRows as any[]).map((e: any) => `- [${e.id}] ${e.name} | ${e.role_title} | ${e.status}`).join('\n')}

=== PRÓXIMOS EVENTOS (${(eventRows as any[]).length}) ===
${(eventRows as any[]).map((e: any) => `- ${e.date}${e.start_time ? ` ${e.start_time}` : ''} | ${e.title}${e.location ? ` @ ${e.location}` : ''}`).join('\n') || 'Nenhum evento próximo'}
${riskSection}${onboardingSection}${surveySection}

Você pode responder perguntas sobre colaboradores, agenda, onboarding, pesquisas e RH.
${actionInstructions}
Quando identificar riscos (alto turnover, atraso no onboarding, score baixo em pesquisa), sugira ações preventivas específicas.`;

  const VALID_ROLES = ['user', 'assistant'];
  const sanitizedMessages = messages
    .filter((m: any) => VALID_ROLES.includes(m.role) && typeof m.content === 'string')
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }));

  if (sanitizedMessages.length === 0) {
    return err(res, 400, 'Nenhuma mensagem válida encontrada');
  }

  // Executa uma ferramenta chamada pelo modelo, reaproveitando exatamente a mesma
  // lógica de validação/negócio dos endpoints REST (createAbsenceRecord/resolveAbsenceApproval).
  async function runTool(name: string, args: any): Promise<string> {
    try {
      if (name === 'criar_ausencia') {
        const result = await createAbsenceRecord(ctx!, {
          employee_id: Number(args.employee_id),
          type: String(args.type ?? ''),
          start_date: String(args.start_date ?? ''),
          end_date: String(args.end_date ?? ''),
          reason: args.reason ? String(args.reason) : undefined,
          hours: args.hours != null ? Number(args.hours) : undefined,
        });
        return JSON.stringify(result.ok ? { ok: true, absence: result.absence } : { ok: false, error: result.error });
      }
      if (name === 'listar_ausencias_pendentes') {
        const rows = await sql`
          SELECT a.id, a.type, a.start_date, a.end_date, a.days_count, e.name AS employee_name
          FROM absences a JOIN employees e ON e.id = a.employee_id
          WHERE a.company_id = ${ctx!.company_id} AND a.status = 'pendente'
          ORDER BY a.created_at ASC LIMIT 20
        `;
        return JSON.stringify({ ok: true, pendentes: rows });
      }
      if (name === 'aprovar_ausencia') {
        const result = await resolveAbsenceApproval(ctx!, Number(args.absence_id), Boolean(args.aprovar));
        return JSON.stringify(result.ok ? { ok: true, absence: result.absence } : { ok: false, error: result.error });
      }
      return JSON.stringify({ ok: false, error: 'Ferramenta desconhecida' });
    } catch (e: unknown) {
      console.error(`[${new Date().toISOString()}] [ERROR] chat/runTool ${name}:`, e);
      return JSON.stringify({ ok: false, error: 'Erro interno ao executar a ação' });
    }
  }

  const convo: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...sanitizedMessages,
  ];

  let reply = 'Não consegui gerar uma resposta.';
  try {
    // Loop curto: o modelo pode encadear até 3 chamadas de ferramenta (ex: listar → aprovar) antes da resposta final
    for (let round = 0; round < 4; round++) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: convo,
        temperature: 0.5,
        max_tokens: 900,
        ...(canAct ? { tools: ABSENCE_TOOLS } : {}),
      });

      const message = completion.choices[0]?.message;
      if (!message) break;

      if (!message.tool_calls || message.tool_calls.length === 0) {
        reply = message.content ?? reply;
        break;
      }

      convo.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls });

      for (const call of message.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* args inválidos: segue com {} */ }
        const result = await runTool(call.function.name, args);
        convo.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }
  } catch {
    return err(res, 502, 'Assistente temporariamente indisponível. Tente novamente em instantes.');
  }

  return res.json({ message: reply });
}
