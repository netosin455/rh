// ============================================================
// api/absences/[id].ts — DELETE /api/absences/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = Number(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!['super_admin','admin','rh'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    await sql`
      DELETE FROM absences
      WHERE id = ${id} AND company_id = ${ctx.company_id}
    `;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
