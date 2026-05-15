// ============================================================
// api/cron/weekly-report.ts
// Vercel Cron — toda segunda-feira às 7h BRT (10h UTC)
// Gera resumo executivo via Groq e envia por email (Resend)
// para todos os usuários rh/admin/super_admin.
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors } from '../_lib';
import Groq from 'groq-sdk';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const CRON_SECRET   = process.env.CRON_SECRET     ?? '';
const APP_URL       = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const REPORT_ROLES = ['rh', 'admin', 'super_admin'];

interface CompanyRow { id: number; name: string }
interface UserRow    { id: number; name: string; email: string }

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SuperRH <noreply@super-rh.vercel.app>', to, subject, html }),
  });
}

async function buildContext(companyId: number): Promise<string> {
  const [summary, absences, risks, onboarding, climate] = await Promise.all([
    // Headcount geral
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM employees WHERE company_id = ${companyId}
      GROUP BY status
    `,
    // Ausências da semana atual
    sql`
      SELECT COUNT(*)::int AS total
      FROM absences
      WHERE company_id = ${companyId}
        AND status = 'aprovado'
        AND start_date >= DATE_TRUNC('week', CURRENT_DATE)
    `,
    // Colaboradores em risco alto
    sql`
      SELECT name, role_title, days_in_company, total_absences_90d
      FROM vw_employee_analytics
      WHERE company_id = ${companyId} AND turnover_risk = 'alto'
      ORDER BY total_absences_90d DESC
      LIMIT 5
    `,
    // Onboardings em andamento
    sql`
      SELECT COUNT(*)::int AS active,
             COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '14 days')::int AS long_running
      FROM onboarding_processes
      WHERE company_id = ${companyId} AND completed_at IS NULL
    `.catch(() => [{ active: 0, long_running: 0 }]),
    // Média de clima dos últimos 30 dias
    sql`
      SELECT ROUND(AVG(pr.score::numeric), 2) AS avg_score, COUNT(*)::int AS responses
      FROM pulse_responses pr
      JOIN pulse_surveys ps ON ps.id = pr.survey_id AND ps.type = 'scale'
      WHERE ps.company_id = ${companyId}
        AND pr.responded_at >= NOW() - INTERVAL '30 days'
        AND pr.score IS NOT NULL
    `.catch(() => [{ avg_score: null, responses: 0 }]),
  ]);

  const statusMap = Object.fromEntries((summary as { status: string; count: number }[]).map(r => [r.status, r.count]));
  const total     = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const clim      = (climate as { avg_score: number | null; responses: number }[])[0];
  const ob        = (onboarding as { active: number; long_running: number }[])[0] ?? { active: 0, long_running: 0 };
  const absWeek   = (absences as { total: number }[])[0]?.total ?? 0;

  const riskList = (risks as { name: string; role_title: string; days_in_company: number; total_absences_90d: number }[])
    .map(r => `- ${r.name} (${r.role_title}): ${r.total_absences_90d} faltas em 90d, ${r.days_in_company} dias de empresa`)
    .join('\n') || 'Nenhum';

  return `
Dados da semana para o escritório (empresa_id: ${companyId}):
- Total de colaboradores: ${total} (ativos: ${statusMap['ativo'] ?? 0}, férias: ${statusMap['ferias'] ?? 0}, licença: ${statusMap['licenca'] ?? 0})
- Ausências aprovadas esta semana: ${absWeek}
- Onboardings em andamento: ${ob.active} (${ob.long_running} há mais de 14 dias)
- Clima organizacional (últimos 30d): ${clim?.avg_score != null ? `${clim.avg_score}/5 (${clim.responses} respostas)` : 'sem dados'}
- Colaboradores com risco de turnover alto:
${riskList}
`.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['authorization'] ?? '';
  const isCronCall = req.headers['x-vercel-cron'] === '1';
  const hasSecret  = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isCronCall && !hasSecret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  let emailsSent = 0;

  try {
    const companies = await sql`SELECT id, name FROM companies` as CompanyRow[];

    for (const company of companies) {
      const users = await sql`
        SELECT id, name, email FROM users
        WHERE company_id = ${company.id}
          AND role = ANY(${REPORT_ROLES})
          AND email IS NOT NULL AND email != ''
      ` as UserRow[];

      if (users.length === 0) continue;

      const context = await buildContext(company.id);

      const chat = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Você é o assistente de RH do ${company.name}. Gere um resumo executivo semanal em português, objetivo e humano, com no máximo 200 palavras. Destaque pontos de atenção, tendências positivas e sugira 1-2 ações concretas para a semana. Seja direto, sem jargões.`,
          },
          {
            role: 'user',
            content: context,
          },
        ],
        max_tokens: 400,
        temperature: 0.6,
      });

      const summary = chat.choices[0]?.message?.content ?? 'Resumo não disponível.';

      const now       = new Date();
      const weekLabel = `Semana ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#F2F0EA;padding:24px;border-radius:12px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="background:#7A6230;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
            <div>
              <h1 style="color:#C9A84C;margin:0;font-size:18px;">SuperRH — Relatório Semanal</h1>
              <p style="color:#8B8B8B;margin:0;font-size:12px;">${weekLabel} · ${company.name}</p>
            </div>
          </div>
          <div style="background:#111114;border:1px solid #1E1E24;border-radius:10px;padding:16px;margin-bottom:16px;line-height:1.7;white-space:pre-wrap;">${summary}</div>
          <a href="${APP_URL}/analytics" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
            Ver Analytics Completo →
          </a>
          <p style="color:#8B8B8B;font-size:11px;margin-top:20px;">Este relatório é gerado automaticamente toda segunda-feira.</p>
        </div>
      `;

      for (const user of users) {
        await sendEmail(user.email, `📊 Relatório Semanal — ${company.name}`, html);
        emailsSent++;
      }
    }

    return res.json({ ok: true, companies: companies.length, emails_sent: emailsSent });
  } catch (e: unknown) {
    const er = e as { message?: string };
    console.error('[cron/weekly-report]', er.message);
    return res.status(500).json({ error: er.message ?? 'Erro interno' });
  }
}
