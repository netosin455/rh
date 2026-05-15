// ============================================================
// api/cron/onboarding-reminders.ts
// Vercel Cron — todo dia às 8h BRT (11h UTC)
// Verifica etapas de onboarding atrasadas e envia email
// via Resend para o responsável.
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors } from '../_lib';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const CRON_SECRET   = process.env.CRON_SECRET     ?? '';
const APP_URL       = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';

interface OnboardingRow {
  id:             number;
  company_id:     number;
  employee_name:  string;
  started_at:     string;
  steps_snapshot: { title: string; description: string; responsible_role: string; days_deadline: number }[];
  steps_progress: Record<string, { completed: boolean; completed_at?: string; reminder_sent_at?: string }>;
}

interface UserRow {
  id: number; name: string; email: string; role: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SuperRH <noreply@super-rh.vercel.app>', to, subject, html }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Proteção: só aceita chamada do Vercel Cron ou com CRON_SECRET
  const authHeader = req.headers['authorization'] ?? '';
  const isCronCall = req.headers['x-vercel-cron'] === '1';
  const hasSecret  = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isCronCall && !hasSecret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const today     = new Date();
  let emailsSent  = 0;
  let checked     = 0;

  try {
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

        // Calcula data limite da etapa
        const deadline = new Date(startedAt);
        deadline.setDate(deadline.getDate() + step.days_deadline);

        const isLate = deadline < today;
        if (!isLate) continue;

        // Evita reenvio: verifica se já mandou lembrete hoje
        if (stepProg.reminder_sent_at) {
          const lastSent = new Date(stepProg.reminder_sent_at);
          const diffDays = Math.floor((today.getTime() - lastSent.getTime()) / 86_400_000);
          if (diffDays < 1) continue;
        }

        checked++;

        // Busca usuários com o role responsável na mesma empresa
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
            `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#F2F0EA;padding:24px;border-radius:12px;">
                <h2 style="color:#C9A84C;margin-bottom:8px;">Etapa de Onboarding Atrasada</h2>
                <p style="color:#8B8B8B;margin-top:0;">Olá, ${user.name}</p>
                <div style="background:#111114;border:1px solid #1E1E24;border-radius:8px;padding:16px;margin:16px 0;">
                  <p><strong>Colaborador:</strong> ${proc.employee_name}</p>
                  <p><strong>Etapa:</strong> ${step.title}</p>
                  <p><strong>Descrição:</strong> ${step.description}</p>
                  <p style="color:#E05252;"><strong>Atraso:</strong> ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''}</p>
                </div>
                <a href="${APP_URL}/onboarding" style="display:inline-block;background:#C9A84C;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">
                  Ver Onboarding
                </a>
              </div>
            `,
          );
          emailsSent++;
        }

        // Marca reminder_sent_at no JSONB
        const newProgress = {
          ...progress,
          [stepKey]: { ...stepProg, reminder_sent_at: today.toISOString() },
        };

        await sql`
          UPDATE onboarding_processes
          SET steps_progress = ${JSON.stringify(newProgress)}::jsonb
          WHERE id = ${proc.id}
        `;
      }
    }

    return res.json({ ok: true, checked, emails_sent: emailsSent });
  } catch (e: unknown) {
    const er = e as { message?: string };
    console.error('[cron/onboarding-reminders]', er.message);
    return res.status(500).json({ error: er.message ?? 'Erro interno' });
  }
}
