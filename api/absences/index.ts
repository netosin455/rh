// ============================================================
// api/absences/index.ts — /api/absences  e  /api/absences/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, CAN_APPROVE_ABSENCES, parsePagination, sendPush } from '../_lib';

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
      const { approved, type, start_date, end_date, reason } = req.body ?? {};

      // Se for uma atualização de dados (não aprovação)
      if (approved === undefined && (type || start_date || end_date || reason !== undefined)) {
        if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) {
          return err(res, 403, 'Sem permissão para editar ausências');
        }
        const rows = await sql`
          UPDATE absences SET
            type       = COALESCE(${type ?? null}, type),
            start_date = COALESCE(${start_date ?? null}, start_date),
            end_date   = COALESCE(${end_date ?? null}, end_date),
            reason     = COALESCE(${reason ?? null}, reason)
          WHERE id = ${id} AND company_id = ${ctx.company_id}
          RETURNING *
        `;
        if (!rows[0]) return err(res, 404, 'Ausência não encontrada');
        return res.json(rows[0]);
      }

      if (!CAN_APPROVE_ABSENCES.includes(ctx.role)) {
        return err(res, 403, 'Sem permissão para aprovar/recusar ausências');
      }
      if (typeof approved !== 'boolean') return err(res, 400, 'Campo "approved" (boolean) é obrigatório');
      const newStatus = approved ? 'aprovado' : 'recusado';

      // Buscar dados da ausência antes de atualizar (tipo, dias, status atual)
      const existing = await sql`
        SELECT type, days_count, status, employee_id
        FROM absences WHERE id = ${id} AND company_id = ${ctx.company_id}
      `;
      if (!existing[0]) return err(res, 404, 'Solicitação não encontrada');
      const absenceData = existing[0] as any;

      const rows = await sql`
        UPDATE absences SET
          status      = ${newStatus},
          approved_by = ${ctx.sub},
          approved_at = now()
        WHERE id = ${id} AND company_id = ${ctx.company_id}
        RETURNING *, (SELECT user_id FROM employees WHERE id = absences.employee_id) AS employee_user_id
      `;
      if (!rows[0]) return err(res, 404, 'Solicitação não encontrada');

      // Descontar ou restaurar vacation_days ao aprovar/recusar férias
      if (absenceData.type === 'ferias') {
        if (approved) {
          await sql`
            UPDATE employees SET vacation_days = GREATEST(0, vacation_days - ${absenceData.days_count})
            WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
          `.catch(() => {});
        } else if (absenceData.status === 'aprovado') {
          // Reverter desconto se estava aprovado e foi recusado agora
          await sql`
            UPDATE employees SET vacation_days = vacation_days + ${absenceData.days_count}
            WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
          `.catch(() => {});
        }
      }

      const empUserId = (rows[0] as any).employee_user_id;
      const notifTitle = approved ? 'Férias aprovadas ✅' : 'Férias recusadas ❌';
      const notifBody  = approved ? 'Sua solicitação de férias foi aprovada.' : 'Sua solicitação de férias foi recusada.';

      // Notificação no centro de notificações
      await sql`
        INSERT INTO notifications (company_id, user_id, title, body, type, route)
        VALUES (${ctx.company_id}, ${empUserId ?? null}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
      `.catch(() => {});

      // Push para o solicitante
      if (empUserId) {
        const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${empUserId}`;
        await sendPush(tokens.map((t: any) => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
      }

      return res.json(rows[0]);
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
      start_date, end_date, reason, attachment_url,
    } = req.body ?? {};

    if (!employee_id || !start_date || !end_date) {
      return err(res, 400, 'employee_id, start_date e end_date são obrigatórios');
    }

    const VALID_TYPES = ['ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','falta','outro'];
    if (!VALID_TYPES.includes(type)) {
      return err(res, 400, `Tipo inválido. Use: ${VALID_TYPES.join(', ')}`);
    }

    const empCheck = await sql`
      SELECT id, name, vacation_days FROM employees
      WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id}
    `;
    if (!empCheck[0]) return err(res, 404, 'Funcionário não encontrado');
    const emp = empCheck[0] as any;

    // Calcular dias solicitados
    const msPerDay = 86_400_000;
    const daysRequested = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / msPerDay) + 1;

    // Validar saldo de férias disponível
    if (type === 'ferias' && daysRequested > emp.vacation_days) {
      return err(res, 422, `Saldo insuficiente. ${emp.name} tem ${emp.vacation_days} dia(s) disponível(is), mas foram solicitados ${daysRequested}.`);
    }

    // Validar sobreposição com ausências existentes no mesmo período
    const overlap = await sql`
      SELECT id FROM absences
      WHERE employee_id = ${Number(employee_id)}
        AND status NOT IN ('recusado', 'cancelado')
        AND start_date <= ${end_date}
        AND end_date   >= ${start_date}
    `;
    if (overlap[0]) {
      return err(res, 409, 'O colaborador já possui uma ausência registrada neste período.');
    }

    const rows = await sql`
      INSERT INTO absences
        (company_id, employee_id, type, start_date, end_date, reason, attachment_url)
      VALUES
        (${ctx.company_id}, ${Number(employee_id)}, ${type}, ${start_date}, ${end_date},
         ${reason ?? null}, ${attachment_url ?? null})
      RETURNING *
    `;

    // Notificar equipe de RH/admin sobre nova solicitação
    const rhUsers = await sql`
      SELECT u.id FROM users u
      WHERE u.company_id = ${ctx.company_id}
        AND u.role IN ('super_admin', 'admin', 'rh')
        AND u.id != ${ctx.sub}
    `.catch(() => []);

    const typeLabel = type === 'ferias' ? 'Férias' : type === 'licenca_medica' ? 'Licença Médica' : type === 'licenca_maternidade' ? 'Lic. Maternidade' : type === 'licenca_paternidade' ? 'Lic. Paternidade' : type === 'folga' ? 'Folga' : type === 'falta' ? 'Falta' : 'Ausência';
    const notifTitle = `Nova solicitação de ${typeLabel}`;
    const notifBody  = `${emp.name} solicitou ${typeLabel.toLowerCase()} de ${start_date} a ${end_date} (${daysRequested} dia${daysRequested > 1 ? 's' : ''})`;

    for (const u of rhUsers as any[]) {
      await sql`
        INSERT INTO notifications (company_id, user_id, title, body, type, route)
        VALUES (${ctx.company_id}, ${u.id}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
      `.catch(() => {});
      const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${u.id}`.catch(() => []);
      await sendPush((tokens as any[]).map(t => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
    }

    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
