// ============================================================
// api/absences/[id]/approve.ts — PATCH /api/absences/:id/approve
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_APPROVE_ABSENCES } from '../../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return err(res, 405, 'Método não permitido');

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  if (!CAN_APPROVE_ABSENCES.includes(ctx.role)) {
    return err(res, 403, 'Sem permissão para aprovar/recusar ausências');
  }

  const id = Number(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  const { approved } = req.body ?? {};
  if (typeof approved !== 'boolean') {
    return err(res, 400, 'Campo "approved" (boolean) é obrigatório');
  }

  const newStatus = approved ? 'aprovado' : 'recusado';

  const rows = await sql`
    UPDATE absences SET
      status      = ${newStatus},
      approved_by = ${ctx.sub},
      approved_at = now()
    WHERE id = ${id} AND company_id = ${ctx.company_id}
    RETURNING *
  `;

  if (!rows[0]) return err(res, 404, 'Solicitação não encontrada');
  return res.json(rows[0]);
}
