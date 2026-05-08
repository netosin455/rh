// ============================================================
// api/notices/index.ts — GET /api/notices  POST /api/notices
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countRow, rows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total
        FROM notices n
        WHERE n.company_id = ${ctx.company_id}
          AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
      `,
      sql`
        SELECT n.*, u.name AS author_name
        FROM notices n
        JOIN users u ON u.id = n.author_id
        WHERE n.company_id = ${ctx.company_id}
          AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
        ORDER BY n.pinned DESC, n.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = countRow[0]?.total ?? 0;
    return res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) {
      return err(res, 403, 'Sem permissão para publicar avisos');
    }
    const { title, body, priority = 'normal', pinned = false, expires_at } = req.body ?? {};

    if (!title || !body) {
      return err(res, 400, 'title e body são obrigatórios');
    }

    const rows = await sql`
      INSERT INTO notices (company_id, author_id, title, body, priority, pinned, expires_at)
      VALUES (${ctx.company_id}, ${ctx.sub}, ${title}, ${body},
              ${priority}, ${pinned}, ${expires_at ?? null})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
