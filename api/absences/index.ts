// ============================================================
// api/absences/index.ts — /api/absences  e  /api/absences/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import {
  sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, CAN_APPROVE_ABSENCES,
  parsePagination, createAbsenceRecord, resolveAbsenceApproval,
  ABSENCE_VALID_TYPES, updateApprovedAbsenceRecord, deleteApprovedAbsenceRecord,
} from '../_lib';
import { isValidIsoDate } from '../../helpers/datas';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
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
        if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role) && !CAN_APPROVE_ABSENCES.includes(ctx.role)) {
          return err(res, 403, 'Sem permissão para editar ausências');
        }
        const existing = await sql`
          SELECT employee_id, type, start_date, end_date, reason, hours, days_count, status
          FROM absences WHERE id = ${id} AND company_id = ${ctx.company_id}
        `;
        if (!existing[0]) return err(res, 404, 'Ausência não encontrada');
        if (!['pendente', 'aprovado'].includes(existing[0].status)) {
          return err(res, 409, 'Somente solicitações pendentes ou aprovadas podem ser editadas');
        }
        if (existing[0].status === 'aprovado' && !CAN_APPROVE_ABSENCES.includes(ctx.role)) {
          return err(res, 403, 'Sem permissão para editar ausência aprovada');
        }

        const current = existing[0] as {
          employee_id: number;
          type: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          hours: number | null;
          days_count: number;
          status: string;
        };
        if (current.status === 'aprovado' && type !== undefined && String(type) !== current.type) {
          return err(res, 409, 'O tipo de uma ausência aprovada não pode ser alterado');
        }
        const nextType = type === undefined ? current.type : String(type);
        const nextStartDate = start_date === undefined ? current.start_date : String(start_date);
        const nextEndDate = end_date === undefined ? current.end_date : String(end_date);
        const nextHours = hours === undefined ? current.hours : (hours == null ? null : Number(hours));

        if (!ABSENCE_VALID_TYPES.includes(nextType)) return err(res, 400, 'Tipo de ausência inválido');
        if (!isValidIsoDate(nextStartDate) || !isValidIsoDate(nextEndDate)) {
          return err(res, 400, 'As datas devem ser válidas e usar o formato YYYY-MM-DD');
        }
        if (nextStartDate > nextEndDate) return err(res, 400, 'A data final deve ser igual ou posterior à inicial');
        if (nextHours != null && (!['folga', 'falta'].includes(nextType) || !Number.isFinite(nextHours) || nextHours <= 0)) {
          return err(res, 400, 'hours só é aceito para folga ou falta e deve ser maior que zero');
        }

        const overlap = await sql`
          SELECT id FROM absences
          WHERE employee_id = ${current.employee_id} AND company_id = ${ctx.company_id}
            AND id != ${id} AND status NOT IN ('recusado', 'cancelado')
            AND start_date <= ${nextEndDate} AND end_date >= ${nextStartDate}
          LIMIT 1
        `;
        if (overlap[0]) return err(res, 409, 'O colaborador já possui uma ausência registrada neste período.');

        if (current.status === 'aprovado') {
          const result = await updateApprovedAbsenceRecord(ctx, {
            id,
            employee_id: Number(current.employee_id),
            type: current.type,
            days_count: Number(current.days_count),
            hours: current.hours == null ? null : Number(current.hours),
          }, {
            start_date: nextStartDate,
            end_date: nextEndDate,
            reason: reason === undefined ? current.reason : (reason == null ? null : String(reason)),
            hours: nextHours,
          });
          if (!result.ok) return err(res, result.status, result.error);
          return res.json(result.absence);
        }

        const rows = await sql`
          UPDATE absences SET
            type       = ${nextType},
            start_date = ${nextStartDate},
            end_date   = ${nextEndDate},
            reason     = ${reason === undefined ? current.reason : (reason == null ? null : String(reason))},
            hours      = ${nextHours}
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
      const existing = await sql`
        SELECT employee_id, type, days_count, hours, status
        FROM absences WHERE id = ${id} AND company_id = ${ctx.company_id}
      `;
      if (!existing[0]) return err(res, 404, 'Ausência não encontrada');
      if (existing[0].status === 'pendente') {
        if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
        await sql`DELETE FROM absences WHERE id = ${id} AND company_id = ${ctx.company_id} AND status = 'pendente'`;
        return res.status(204).end();
      }
      if (existing[0].status === 'aprovado') {
        if (!CAN_APPROVE_ABSENCES.includes(ctx.role)) return err(res, 403, 'Sem permissão para excluir ausência aprovada');
        const deleted = await deleteApprovedAbsenceRecord(ctx, {
          id,
          employee_id: Number(existing[0].employee_id),
          type: String(existing[0].type),
          days_count: Number(existing[0].days_count),
          hours: existing[0].hours == null ? null : Number(existing[0].hours),
        });
        if (!deleted) return err(res, 404, 'Ausência não encontrada');
        return res.status(204).end();
      }
      return err(res, 409, 'Somente solicitações pendentes ou aprovadas podem ser excluídas');
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Rotas de coleção ─────────────────────────────────────

  if (req.method === 'GET') {
    const { status, employee_id, type, month } = req.query;
    let empId = employee_id ? Number(employee_id) : null;
    const typeVal = type   ? String(type)   : null;
    const monthVal= month  ? String(month)  : null; // YYYY-MM
    const { page, limit, offset } = parsePagination(req.query);

    if (empId != null && (!Number.isInteger(empId) || empId <= 0)) return err(res, 400, 'employee_id inválido');

    // Colaboradores veem somente o próprio histórico, inclusive para não expor
    // motivos e anexos de licença de colegas. RH/admin/gestor mantém visão geral.
    const canViewAll = CAN_MANAGE_EMPLOYEES.includes(ctx.role) || CAN_APPROVE_ABSENCES.includes(ctx.role);
    if (!canViewAll) {
      const self = await sql`
        SELECT id FROM employees
        WHERE user_id = ${ctx.sub} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
      `;
      if (!self[0]) return res.json({ data: [], total: 0, page, limit, totalPages: 0 });
      empId = Number(self[0].id);
    }

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
