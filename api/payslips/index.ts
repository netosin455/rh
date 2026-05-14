// ============================================================
// api/payslips/index.ts — GET/POST /api/payslips | DELETE /api/payslips/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

const CAN_MANAGE = ['super_admin', 'admin', 'rh', 'adm'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = req.query.id ? Number(req.query.id) : null;

  // ── DELETE /:id (RH/admin only) ───────────────────────────
  if (id && req.method === 'DELETE') {
    if (!CAN_MANAGE.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    const rows = await sql`SELECT id FROM payslips WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    if (!rows[0]) return err(res, 404, 'Holerite não encontrado');
    await sql`DELETE FROM payslips WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const canManage = CAN_MANAGE.includes(ctx.role);
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;

    if (canManage) {
      // RH vê tudo; pode filtrar por ?employee_id
      const rows = employeeId
        ? await sql`
            SELECT p.*, e.name AS employee_name
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            WHERE p.company_id = ${ctx.company_id} AND p.employee_id = ${employeeId}
            ORDER BY p.month DESC
          `
        : await sql`
            SELECT p.*, e.name AS employee_name
            FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            WHERE p.company_id = ${ctx.company_id}
            ORDER BY p.month DESC
            LIMIT 100
          `;
      return res.json(rows);
    }

    // Colaborador vê apenas os próprios holerites
    const empRows = await sql`
      SELECT id FROM employees WHERE user_id = ${ctx.sub} AND company_id = ${ctx.company_id}
    `;
    if (!empRows[0]) return res.json([]);

    const rows = await sql`
      SELECT p.*, e.name AS employee_name
      FROM payslips p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.company_id = ${ctx.company_id} AND p.employee_id = ${empRows[0].id as number}
      ORDER BY p.month DESC
    `;
    return res.json(rows);
  }

  // ── POST (RH/admin only) ──────────────────────────────────
  if (req.method === 'POST') {
    if (!CAN_MANAGE.includes(ctx.role)) return err(res, 403, 'Sem permissão');

    const { employee_id, month, description, file_url } = req.body ?? {};

    if (!employee_id || !month || !file_url) {
      return err(res, 400, 'employee_id, month e file_url são obrigatórios');
    }
    if (!/^\d{4}-\d{2}$/.test(month)) return err(res, 400, 'month deve ter formato YYYY-MM');

    const emp = await sql`
      SELECT id FROM employees WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id}
    `;
    if (!emp[0]) return err(res, 404, 'Colaborador não encontrado');

    const rows = await sql`
      INSERT INTO payslips (company_id, employee_id, month, description, file_url, created_by)
      VALUES (${ctx.company_id}, ${Number(employee_id)}, ${month}, ${description ?? null}, ${file_url}, ${ctx.sub})
      ON CONFLICT (employee_id, month) DO UPDATE
        SET description = EXCLUDED.description,
            file_url    = EXCLUDED.file_url,
            created_by  = EXCLUDED.created_by
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
