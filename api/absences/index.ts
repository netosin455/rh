// ============================================================
// api/absences/index.ts — /api/absences  e  /api/absences/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, CAN_APPROVE_ABSENCES, parsePagination, sendPush, createAbsenceRecord, resolveAbsenceApproval } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── Rotas com :id ─────────────────────────────────────────
  if (req.query.id) {
    const id = Number(req.query.id);
    if (!id) return err(res, 400, 'ID inválido');

    if (req.method === 'PATCH') {
      const { approved, type, start_date, end_date, reason, hours } = req.body ?? {};

      // Se for uma atualização de dados (não aprovação)
      if (approved === undefined && (type || start_date || end_date || reason !== undefined || hours !== undefined)) {
        if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) {
          return err(res, 403, 'Sem permissão para editar ausências');
        }
        const rows = await sql`
          UPDATE absences SET
            type       = COALESCE(${type ?? null}, type),
            start_date = COALESCE(${start_date ?? null}, start_date),
            end_date   = COALESCE(${end_date ?? null}, end_date),
            reason     = COALESCE(${reason ?? null}, reason),
            hours      = COALESCE(${hours ?? null}, hours)
          WHERE id = ${id} AND company_id = ${ctx.company_id}
          RETURNING *
        `;
        if (!rows[0]) return err(res, 404, 'Ausência não encontrada');
        return res.json(rows[0]);
      }

      if (typeof approved !== 'boolean') return err(res, 400, 'Campo "approved" (boolean) é obrigatório');

      const result = await resolveAbsenceApproval(ctx, id, approved);
      if (!result.ok) return err(res, result.status, result.error);
      return res.json(result.absence);
    }

    if (req.method === 'DELETE') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      await sql`DELETE FROM absences WHERE id = ${id} AND company_id = ${ctx.company_id}`;
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Rotas de coleção ─────────────────────────────────────

  if (req.method === 'GET') {
    const { status, employee_id, type, month } = req.query;
    const empId   = employee_id ? Number(employee_id) : null;
    const typeVal = type   ? String(type)   : null;
    const monthVal= month  ? String(month)  : null; // YYYY-MM
    const { page, limit, offset } = parsePagination(req.query);

    const [countRow, rows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS total FROM absences a
        WHERE a.company_id = ${ctx.company_id}
          AND (${empId}::int IS NULL OR a.employee_id = ${empId})
          AND (${status ?? null}::text IS NULL OR a.status = ${String(status ?? '')})
          AND (${typeVal}::text IS NULL OR a.type = ${typeVal})
          AND (${monthVal}::text IS NULL OR to_char(a.start_date, 'YYYY-MM') = ${monthVal})
      `,
      sql`
        SELECT a.*, e.name AS employee_name, e.role_title
        FROM absences a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.company_id = ${ctx.company_id}
          AND (${empId}::int IS NULL OR a.employee_id = ${empId})
          AND (${status ?? null}::text IS NULL OR a.status = ${String(status ?? '')})
          AND (${typeVal}::text IS NULL OR a.type = ${typeVal})
          AND (${monthVal}::text IS NULL OR to_char(a.start_date, 'YYYY-MM') = ${monthVal})
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = countRow[0]?.total ?? 0;
    return res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (req.method === 'POST') {
    const {
      employee_id, type = 'ferias',
      start_date, end_date, reason, attachment_url, hours,
    } = req.body ?? {};

    const result = await createAbsenceRecord(ctx, { employee_id, type, start_date, end_date, reason, attachment_url, hours });
    if (!result.ok) return err(res, result.status, result.error);
    return res.status(result.status).json(result.absence);
  }

  return err(res, 405, 'Método não permitido');
}
