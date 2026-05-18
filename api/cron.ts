// ============================================================
// api/cron.ts — Vercel Cron dispatcher
// ?job=onboarding-reminders  →  diário 8h BRT (11h UTC)
// ?job=weekly-report         →  segunda-feira 7h BRT (10h UTC)
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors } from './_lib';
import Groq from 'groq-sdk';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const CRON_SECRET   = process.env.CRON_SECRET     ?? '';
const APP_URL       = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Shared helpers ────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SuperRH <noreply@super-rh.vercel.app>', to, subject, html }),
  });
}

// ── Job: onboarding-reminders ─────────────────────────────────

interface OnboardingRow {
  id:             number;
  company_id:     number;
  employee_name:  string;
  started_at:     string;
  steps_snapshot: { title: string; description: string; responsible_role: string; days_deadline: number }[];
  steps_progress: Record<string, { completed: boolean; completed_at?: string; reminder_sent_at?: string }>;
}

interface UserRow { id: number; name: string; email: string; role: string }

async function runOnboardingReminders(): Promise<{ checked: number; emails_sent: number }> {
  const today    = new Date();
  let emailsSent = 0;
  let checked    = 0;

  const processes = await sql`
    SELECT
      op.id, op.company_id, op.started_at,
      op.steps_snapshot, op.steps_progress,
      e.name AS employee_name
    FROM onboarding_processes op
    JOIN employees e ON e.id = op.employee_id
    WHERE op.completed_at IS NULL
    ORDER BY op.started_at ASC
  `;

  for (const proc of processes as OnboardingRow[]) {
    const startedAt = new Date(proc.started_at);
    const snapshot  = proc.steps_snapshot ?? [];
    const progress  = proc.steps_progress ?? {};

    for (let i = 0; i < snapshot.length; i++) {
      const step     = snapshot[i];
      const stepKey  = String(i);
      const stepProg = progress[stepKey] ?? { completed: false };

      if (stepProg.completed) continue;

      const deadline = new Date(startedAt);
      deadline.setDate(deadline.getDate() + step.days_deadline);
      if (deadline >= today) continue;

      if (stepProg.reminder_sent_at) {
        const diffDays = Math.floor((today.getTime() - new Date(stepProg.reminder_sent_at).getTime()) / 86_400_000);
        if (diffDays < 1) continue;
      }

      checked++;

      const users = await sql`
        SELECT id, name, email, role FROM users
        WHERE company_id = ${proc.company_id}
          AND role = ${step.responsible_role}
        LIMIT 5
      `;

      for (const user of users as UserRow[]) {
        if (!user.email) continue;
        const diasAtraso = Math.floor((today.getTime() - deadline.getTime()) / 86_400_000);
        await sendEmail(
          user.email,
          `⚠️ Onboarding de ${proc.employee_name} — etapa atrasada`,
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#F2F0EA;padding:24px;border-radius:12px;">
            <h2 style="color:#C9A84C;margin-bottom:8px;">Etapa de Onboarding Atrasada</h2>
            <p style="color:#8B8B8B;margin-top:0;">Olá, ${user.name}</p>
            <div style="background:#111114;border:1px solid #1E1E24;border-radius:8px;padding:16px;margin:16px 0;">
              <p><strong>Colaborador:</strong> ${proc.employee_name}</p>
              <p><strong>Etapa:</strong> ${step.title}</p>
              <p><strong>Descrição:</strong> ${step.description}</p>
              <p style="color:#E05252;"><strong>Atraso:</strong> ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}</p>
            </div>
            <a href="${APP_URL}/onboarding" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Ver Onboarding</a>
          </div>`,
        );
        emailsSent++;
      }

      const newProgress = { ...progress, [stepKey]: { ...stepProg, reminder_sent_at: today.toISOString() } };
      await sql`
        UPDATE onboarding_processes
        SET steps_progress = ${JSON.stringify(newProgress)}::jsonb
        WHERE id = ${proc.id}
      `;
    }
  }

  return { checked, emails_sent: emailsSent };
}

// ── Job: weekly-report ────────────────────────────────────────

interface CompanyRow { id: number; name: string }
interface ReportUserRow { id: number; name: string; email: string }

const REPORT_ROLES = ['rh', 'admin', 'super_admin'];

async function fetchOnboardingStatus(companyId: number): Promise<{ active: number; long_running: number }> {
  const rows = await sql`
    SELECT COUNT(*)::int AS active,
           COUNT(*) FILTER (WHERE started_at < NOW() - INTERVAL '14 days')::int AS long_running
    FROM onboarding_processes
    WHERE company_id = ${companyId} AND completed_at IS NULL
  `.catch((e: unknown) => {
    console.error(`[${new Date().toISOString()}] [ERROR] cron/fetchOnboardingStatus company=${companyId}:`, e);
    return [{ active: 0, long_running: 0 }];
  });
  return (rows as { active: number; long_running: number }[])[0] ?? { active: 0, long_running: 0 };
}

async function fetchClimateScore(companyId: number): Promise<{ avg_score: number | null; responses: number }> {
  const rows = await sql`
    SELECT ROUND(AVG(pr.score::numeric), 2) AS avg_score, COUNT(*)::int AS responses
    FROM pulse_responses pr
    JOIN pulse_surveys ps ON ps.id = pr.survey_id AND ps.type = 'scale'
    WHERE ps.company_id = ${companyId}
      AND pr.responded_at >= NOW() - INTERVAL '30 days'
      AND pr.score IS NOT NULL
  `.catch((e: unknown) => {
    console.error(`[${new Date().toISOString()}] [ERROR] cron/fetchClimateScore company=${companyId}:`, e);
    return [{ avg_score: null, responses: 0 }];
  });
  return (rows as { avg_score: number | null; responses: number }[])[0] ?? { avg_score: null, responses: 0 };
}

async function buildWeeklyContext(companyId: number): Promise<string> {
  const [summary, absences, risks, onboarding, climate] = await Promise.all([
    sql`SELECT status, COUNT(*)::int AS count FROM employees WHERE company_id = ${companyId} GROUP BY status`,
    sql`
      SELECT COUNT(*)::int AS total FROM absences
      WHERE company_id = ${companyId} AND status = 'aprovado'
        AND start_date >= DATE_TRUNC('week', CURRENT_DATE)
    `,
    sql`
      SELECT name, role_title, days_in_company, total_absences_90d
      FROM vw_employee_analytics
      WHERE company_id = ${companyId} AND turnover_risk = 'alto'
      ORDER BY total_absences_90d DESC LIMIT 5
    `,
    fetchOnboardingStatus(companyId),
    fetchClimateScore(companyId),
  ]);

  const statusMap = Object.fromEntries((summary as { status: string; count: number }[]).map(r => [r.status, r.count]));
  const total     = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const absWeek   = (absences as { total: number }[])[0]?.total ?? 0;

  const riskList = (risks as { name: string; role_title: string; days_in_company: number; total_absences_90d: number }[])
    .map(r => `- ${r.name} (${r.role_title}): ${r.total_absences_90d} faltas em 90d, ${r.days_in_company} dias de empresa`)
    .join('\n') || 'Nenhum';

  return `
Dados da semana para o escritório (empresa_id: ${companyId}):
- Total de colaboradores: ${total} (ativos: ${statusMap['ativo'] ?? 0}, férias: ${statusMap['ferias'] ?? 0}, licença: ${statusMap['licenca'] ?? 0})
- Ausências aprovadas esta semana: ${absWeek}
- Onboardings em andamento: ${onboarding.active} (${onboarding.long_running} há mais de 14 dias)
- Clima organizacional (últimos 30d): ${climate.avg_score != null ? `${climate.avg_score}/5 (${climate.responses} respostas)` : 'sem dados'}
- Colaboradores com risco de turnover alto:
${riskList}
`.trim();
}

async function runWeeklyReport(): Promise<{ companies: number; emails_sent: number }> {
  let emailsSent = 0;
  const companies = await sql`SELECT id, name FROM companies` as CompanyRow[];

  for (const company of companies) {
    const users = await sql`
      SELECT id, name, email FROM users
      WHERE company_id = ${company.id}
        AND role = ANY(${REPORT_ROLES})
        AND email IS NOT NULL AND email != ''
    ` as ReportUserRow[];

    if (users.length === 0) continue;

    const context = await buildWeeklyContext(company.id);

    const chat = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Você é o assistente de RH do ${company.name}. Gere um resumo executivo semanal em português, objetivo e humano, com no máximo 200 palavras. Destaque pontos de atenção, tendências positivas e sugira 1-2 ações concretas para a semana. Seja direto, sem jargões.`,
        },
        { role: 'user', content: context },
      ],
      max_tokens: 400,
      temperature: 0.6,
    });

    const summary   = chat.choices[0]?.message?.content ?? 'Resumo não disponível.';
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

  return { companies: companies.length, emails_sent: emailsSent };
}

// ── Main handler ──────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers['authorization'] ?? '';
  const isCronCall = req.headers['x-vercel-cron'] === '1';
  const hasSecret  = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isCronCall && !hasSecret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const job = req.query.job as string | undefined;

  try {
    if (job === 'onboarding-reminders') {
      const result = await runOnboardingReminders();
      return res.json({ ok: true, job, ...result });
    }

    if (job === 'weekly-report') {
      const result = await runWeeklyReport();
      return res.json({ ok: true, job, ...result });
    }

    return res.status(400).json({ error: 'job inválido. Use ?job=onboarding-reminders ou ?job=weekly-report' });
  } catch (e: unknown) {
    const er = e as { message?: string };
    console.error(`[cron/${job}]`, er.message);
    return res.status(500).json({ error: er.message ?? 'Erro interno' });
  }
}
