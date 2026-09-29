// GET /api/feedback/public/:token; POST :token/acknowledge; GET :token/pdf

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { cors, err, sql } from '../_lib';
import { createFeedbackPdf } from './_pdf';
import { findPublicFeedback, isFeedbackToken, type PublicFeedbackRow } from './_public';

function privateResponse(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function asPublicResponse(row: PublicFeedbackRow) {
  return {
    title: row.title,
    content: row.content,
    employee_name: row.employee_name,
    company_name: row.company_name,
    status: row.status,
    published_at: row.published_at,
    acknowledged_at: row.acknowledged_at,
  };
}

async function activeFeedback(res: VercelResponse, token: string): Promise<PublicFeedbackRow | null> {
  const feedback = await findPublicFeedback(token);
  if (!feedback || !['published', 'acknowledged', 'revoked'].includes(feedback.status)) {
    err(res, 404, 'Feedback não encontrado');
    return null;
  }
  if (feedback.status === 'revoked') {
    err(res, 410, 'Este link de feedback foi revogado');
    return null;
  }
  return feedback;
}

async function acknowledge(res: VercelResponse, token: string, body: unknown) {
  if ((body as { acknowledged?: unknown } | null)?.acknowledged !== true) return err(res, 400, 'Confirmação de leitura obrigatória');
  const feedback = await activeFeedback(res, token);
  if (!feedback) return;
  if (feedback.status === 'acknowledged') return res.json({ acknowledged_at: feedback.acknowledged_at, already_acknowledged: true });
  const rows = await sql`
    UPDATE feedbacks SET status = 'acknowledged', acknowledged_at = now()
    WHERE public_token = ${token} AND status = 'published' AND acknowledged_at IS NULL
    RETURNING acknowledged_at
  `;
  if (rows[0]) return res.json({ acknowledged_at: rows[0].acknowledged_at, already_acknowledged: false });
  const current = await activeFeedback(res, token);
  if (current?.status === 'acknowledged') return res.json({ acknowledged_at: current.acknowledged_at, already_acknowledged: true });
}

async function downloadPdf(res: VercelResponse, token: string) {
  const feedback = await activeFeedback(res, token);
  if (!feedback) return;
  const bytes = await createFeedbackPdf(feedback);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="feedback.pdf"');
  return res.status(200).send(Buffer.from(bytes));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  privateResponse(res);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!isFeedbackToken(token)) return err(res, 404, 'Feedback não encontrado');
  if (req.method === 'GET' && req.query.action === 'pdf') return downloadPdf(res, token);
  if (req.method === 'POST' && req.query.action === 'acknowledge') return acknowledge(res, token, req.body);
  if (req.method === 'GET') { const feedback = await activeFeedback(res, token); return feedback ? res.json(asPublicResponse(feedback)) : undefined; }
  return err(res, 405, 'Método não permitido');
}
