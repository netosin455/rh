// ============================================================
// api/notices/index.ts — /api/notices  e  /api/notices/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, parsePagination, sendPush } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── Rotas com :id ─────────────────────────────────────────
  if (req.query.id) {
    const id = Number(req.query.id);
    if (!id) return err(res, 400, 'ID inválido');

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT n.*, u.name AS author_name
        FROM notices n JOIN users u ON u.id = n.author_id
        WHERE n.id = ${id} AND n.company_id = ${ctx.company_id}
      `;
      if (!rows[0]) return err(res, 404, 'Aviso não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'PUT') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      const { title, body, priority, pinned, expires_at } = req.body ?? {};
      const rows = await sql`
        UPDATE notices SET
          title      = COALESCE(${title      ?? null}, title),
          body       = COALESCE(${body       ?? null}, body),
          priority   = COALESCE(${priority   ?? null}, priority),
          pinned     = COALESCE(${pinned     ?? null}, pinned),
          expires_at = COALESCE(${expires_at ?? null}, expires_at)
        WHERE id = ${id} AND company_id = ${ctx.company_id}
        RETURNING *
      `;
      if (!rows[0]) return err(res, 404, 'Aviso não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'PATCH') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      const { pinned } = req.body ?? {};
      if (typeof pinned !== 'boolean') return err(res, 400, 'Campo "pinned" deve ser boolean');
      const rows = await sql`
        UPDATE notices SET pinned = ${pinned}
        WHERE id = ${id} AND company_id = ${ctx.company_id}
        RETURNING *
      `;
      if (!rows[0]) return err(res, 404, 'Aviso não encontrado');

      if (pinned) {
        const notifTitle = '📌 Aviso fixado';
        const notifBody  = String((rows[0] as any).title);

        // Notificação para todos da empresa
        await sql`
          INSERT INTO notifications (company_id, user_id, title, body, type, route)
          VALUES (${ctx.company_id}, NULL, ${notifTitle}, ${notifBody}, 'aviso', '/(tabs)/avisos')
        `.catch(() => {});

        // Push
        const tokens = await sql`
          SELECT pt.token FROM push_tokens pt
          JOIN users u ON u.id = pt.user_id
          WHERE u.company_id = ${ctx.company_id}
        `;
        await sendPush(tokens.map((t: any) => t.token), notifTitle, notifBody, { route: '/(tabs)/avisos' });
      }
      return res.json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      await sql`DELETE FROM notices WHERE id = ${id} AND company_id = ${ctx.company_id}`;
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Rotas de coleção ─────────────────────────────────────

  if (req.method === 'GET') {
    const { page, limit, offset } = parsePagination(req.query);

    const [countRow, rows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total FROM notices n
        WHERE n.company_id = ${ctx.company_id}
          AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
      `,
      sql`
        SELECT n.*, u.name AS author_name
        FROM notices n JOIN users u ON u.id = n.author_id
        WHERE n.company_id = ${ctx.company_id}
          AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
        ORDER BY n.pinned DESC, n.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = countRow[0]?.total ?? 0;
    return res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) {
      return err(res, 403, 'Sem permissão para publicar avisos');
    }
    const { title, body, priority = 'normal', pinned = false, expires_at } = req.body ?? {};
    if (!title || !body) return err(res, 400, 'title e body são obrigatórios');

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
