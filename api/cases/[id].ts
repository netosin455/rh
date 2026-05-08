// ============================================================
// api/cases/[id].ts — GET PUT DELETE /api/cases/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = Number(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT c.*, e.name AS responsible_name
      FROM legal_cases c
      LEFT JOIN employees e ON e.id = c.responsible_id
      WHERE c.id = ${id} AND c.company_id = ${ctx.company_id}
    `;
    if (!rows[0]) return err(res, 404, 'Processo não encontrado');
    return res.json(rows[0]);
  }

  // ── PUT ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role) && !['juridico', 'gestor'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    const {
      case_number, title, area, status,
      client_name, responsible_id, court, deadline, description,
    } = req.body ?? {};

    const rows = await sql`
      UPDATE legal_cases SET
        case_number    = COALESCE(${case_number    ?? null}, case_number),
        title          = COALESCE(${title          ?? null}, title),
        area           = COALESCE(${area           ?? null}, area),
        status         = COALESCE(${status         ?? null}, status),
        client_name    = COALESCE(${client_name    ?? null}, client_name),
        responsible_id = COALESCE(${responsible_id ?? null}, responsible_id),
        court          = COALESCE(${court          ?? null}, court),
        deadline       = COALESCE(${deadline       ?? null}, deadline),
        description    = COALESCE(${description    ?? null}, description)
      WHERE id = ${id} AND company_id = ${ctx.company_id}
      RETURNING *
    `;
    if (!rows[0]) return err(res, 404, 'Processo não encontrado');
    return res.json(rows[0]);
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!['super_admin', 'admin', 'juridico'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    await sql`DELETE FROM legal_cases WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
