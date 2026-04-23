// ============================================================
// api/events/[id].ts — GET PUT DELETE /api/events/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = String(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT * FROM events
      WHERE id = ${id}
        AND company_id = ${ctx.company_id}
        AND user_id    = ${ctx.sub}
    `;
    if (!rows[0]) return err(res, 404, 'Evento não encontrado');
    return res.json(rows[0]);
  }

  // ── PUT ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const {
      title, description, date, start_time, end_time,
      color, category, case_id, location, is_all_day,
    } = req.body ?? {};

    const rows = await sql`
      UPDATE events SET
        title       = COALESCE(${title       ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        date        = COALESCE(${date        ?? null}, date),
        start_time  = COALESCE(${start_time  ?? null}, start_time),
        end_time    = COALESCE(${end_time    ?? null}, end_time),
        color       = COALESCE(${color       ?? null}, color),
        category    = COALESCE(${category    ?? null}, category),
        case_id     = COALESCE(${case_id     ?? null}, case_id),
        location    = COALESCE(${location    ?? null}, location),
        is_all_day  = COALESCE(${is_all_day  ?? null}, is_all_day)
      WHERE id         = ${id}
        AND company_id = ${ctx.company_id}
        AND user_id    = ${ctx.sub}
      RETURNING *
    `;
    if (!rows[0]) return err(res, 404, 'Evento não encontrado');
    return res.json(rows[0]);
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await sql`
      DELETE FROM events
      WHERE id         = ${id}
        AND company_id = ${ctx.company_id}
        AND user_id    = ${ctx.sub}
    `;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
