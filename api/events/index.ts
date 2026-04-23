// ============================================================
// api/events/index.ts — GET /api/events  POST /api/events
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
    const { month, date, upcoming, limit = '10' } = req.query;

    let rows;

    if (upcoming === 'true') {
      const today = new Date().toISOString().slice(0, 10);
      rows = await sql`
        SELECT e.*, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id}
          AND e.user_id    = ${ctx.sub}
          AND e.date       >= ${today}
        ORDER BY e.date ASC, e.start_time ASC
        LIMIT ${Number(limit)}
      `;
    } else if (date) {
      rows = await sql`
        SELECT e.*, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id}
          AND e.user_id    = ${ctx.sub}
          AND e.date       = ${String(date)}
        ORDER BY e.start_time ASC
      `;
    } else if (month) {
      // month = "YYYY-MM"
      rows = await sql`
        SELECT e.*, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id}
          AND e.user_id    = ${ctx.sub}
          AND e.date LIKE ${`${String(month)}%`}
        ORDER BY e.date ASC, e.start_time ASC
      `;
    } else {
      rows = await sql`
        SELECT e.*, c.case_number, c.title AS case_title
        FROM events e
        LEFT JOIN legal_cases c ON c.id = e.case_id
        WHERE e.company_id = ${ctx.company_id}
          AND e.user_id    = ${ctx.sub}
        ORDER BY e.date DESC
        LIMIT 100
      `;
    }

    return res.json(rows);
  }

  // ── POST ──────────────────────────────────────────────────
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
