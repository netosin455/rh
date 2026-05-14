// ============================================================
// api/events/index.ts — GET/POST /api/events | GET/PUT/DELETE /api/events/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, IS_ADMIN } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = req.query.id ? String(req.query.id) : null;

  // ── Item routes /:id ──────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT e.*, u.name AS created_by_name
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.id = ${id} AND e.company_id = ${ctx.company_id}
      `;
      if (!rows[0]) return err(res, 404, 'Evento não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'PUT') {
      const isAdmin = IS_ADMIN.includes(ctx.role) || ['rh', 'adm'].includes(ctx.role);
      const existing = await sql`
        SELECT user_id FROM events WHERE id = ${id} AND company_id = ${ctx.company_id}
      `;
      if (!existing[0]) return err(res, 404, 'Evento não encontrado');
      if (!isAdmin && existing[0].user_id !== ctx.sub) return err(res, 403, 'Sem permissão');

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
        WHERE id = ${id} AND company_id = ${ctx.company_id}
        RETURNING *
      `;
      return res.json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const isAdmin = IS_ADMIN.includes(ctx.role) || ['rh', 'adm'].includes(ctx.role);
      const existing = await sql`
        SELECT user_id FROM events WHERE id = ${id} AND company_id = ${ctx.company_id}
      `;
      if (!existing[0]) return err(res, 404, 'Evento não encontrado');
      if (!isAdmin && existing[0].user_id !== ctx.sub) return err(res, 403, 'Sem permissão');

      await sql`DELETE FROM events WHERE id = ${id} AND company_id = ${ctx.company_id}`;
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Collection routes ─────────────────────────────────────
  if (req.method === 'GET') {
    const { month, date, upcoming, limit = '10' } = req.query;

    let rows;
    if (upcoming === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      rows = await sql`
        SELECT e.*, u.name AS created_by_name, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id} AND e.date >= ${today}
        ORDER BY e.date ASC, e.start_time ASC
        LIMIT ${Number(limit)}
      `;
    } else if (date) {
      rows = await sql`
        SELECT e.*, u.name AS created_by_name, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id} AND e.date = ${String(date)}
        ORDER BY e.start_time ASC
      `;
    } else if (month) {
      rows = await sql`
        SELECT e.*, u.name AS created_by_name, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id} AND e.date LIKE ${`${String(month)}%`}
        ORDER BY e.date ASC, e.start_time ASC
      `;
    } else {
      rows = await sql`
        SELECT e.*, u.name AS created_by_name, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id}
        ORDER BY e.date DESC
        LIMIT 100
      `;
    }
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const {
      title, description, date, start_time, end_time,
      color = '#C9A84C', category = 'outro',
      case_id, location, is_all_day = false,
    } = req.body ?? {};

    if (!title || !date) return err(res, 400, 'title e date são obrigatórios');

    const rows = await sql`
      INSERT INTO events
        (company_id, user_id, title, description, date, start_time, end_time,
         color, category, case_id, location, is_all_day)
      VALUES
        (${ctx.company_id}, ${ctx.sub}, ${title}, ${description ?? null},
         ${date}, ${start_time ?? null}, ${end_time ?? null},
         ${color}, ${category}, ${case_id ?? null},
         ${location ?? null}, ${is_all_day})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
