// ============================================================
// api/notices/[id].ts — PATCH DELETE /api/notices/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, IS_ADMIN } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  if (!IS_ADMIN.includes(ctx.role)) return err(res, 403, 'Sem permissão');

  const id = Number(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  // ── PATCH ─────────────────────────────────────────────────
  if (req.method === 'PATCH') {
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

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await sql`
      DELETE FROM notices
      WHERE id = ${id} AND company_id = ${ctx.company_id}
    `;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
