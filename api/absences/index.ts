// ============================================================
// api/absences/index.ts — GET /api/absences  POST /api/absences
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { status } = req.query;

    const rows = status
      ? await sql`
          SELECT a.*, e.name AS employee_name, e.role_title
          FROM absences a
          JOIN employees e ON e.id = a.employee_id
          WHERE a.company_id = ${ctx.company_id} AND a.status = ${String(status)}
          ORDER BY a.created_at DESC
        `
      : await sql`
          SELECT a.*, e.name AS employee_name, e.role_title
          FROM absences a
          JOIN employees e ON e.id = a.employee_id
          WHERE a.company_id = ${ctx.company_id}
          ORDER BY a.created_at DESC
        `;

    return res.json(rows);
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      employee_id, type = 'ferias',
      start_date, end_date, reason, attachment_url,
    } = req.body ?? {};

    if (!employee_id || !start_date || !end_date) {
      return err(res, 400, 'employee_id, start_date e end_date são obrigatórios');
    }

    const rows = await sql`
      INSERT INTO absences
        (company_id, employee_id, type, start_date, end_date, reason, attachment_url)
      VALUES
        (${ctx.company_id}, ${employee_id}, ${type}, ${start_date}, ${end_date},
         ${reason ?? null}, ${attachment_url ?? null})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
