// ============================================================
// api/chat.ts — POST /api/chat
// Assistente IA powered by Groq (llama-3.3-70b)
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

  // Busca contexto da empresa no banco
  const [empRows, eventRows] = await Promise.all([
    sql`SELECT name, role_title, status FROM employees WHERE company_id = ${ctx.company_id} AND status != 'desligado' ORDER BY name LIMIT 30`,
    sql`
      SELECT title, date, start_time, category, location
      FROM events
      WHERE company_id = ${ctx.company_id}
        AND user_id    = ${ctx.sub}
        AND date       >= to_char(current_date, 'YYYY-MM-DD')
      ORDER BY date ASC, start_time ASC
      LIMIT 10
    `,
  ]);

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `Você é o assistente de RH do SuperRH.
Responda sempre em português brasileiro, de forma concisa e profissional.
Hoje é ${today}. O usuário logado é ${ctx.name} (${ctx.role}).

=== COLABORADORES ATIVOS (${empRows.length}) ===
${empRows.map(e => `- ${e.name} | ${e.role_title} | ${e.status}`).join('\n')}

=== PRÓXIMOS EVENTOS (${eventRows.length}) ===
${eventRows.map(e => `- ${e.date}${e.start_time ? ` ${e.start_time}` : ''} | ${e.title} | ${e.category}${e.location ? ` @ ${e.location}` : ''}`).join('\n')}

Você pode responder perguntas sobre colaboradores, agenda e RH com base nos dados acima.
Para ações que criam ou modificam dados, oriente o usuário a usar as telas do app.`;

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
      max_tokens: 800,
    });
  } catch {
    return err(res, 502, 'Assistente temporariamente indisponível. Tente novamente em instantes.');
  }

  const reply = completion.choices[0]?.message?.content ?? 'Não consegui gerar uma resposta.';
  return res.json({ message: reply });
}
