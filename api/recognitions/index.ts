// ============================================================
// api/recognitions/index.ts
// GET/POST /api/recognitions | DELETE /api/recognitions/:id
// GET/POST /api/payslips     | DELETE /api/payslips/:id
//   (payslips routed here via ?type=payslips in vercel.json)
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, IS_ADMIN } from '../_lib';

const VALID_CATEGORIES = ['trabalho_em_equipe', 'inovacao', 'lideranca', 'atendimento', 'resultado', 'outro'];
const CAN_MANAGE_PAYSLIPS = ['super_admin', 'admin', 'rh', 'adm'];

// ── Payslips handlers ─────────────────────────────────────────

async function handlePayslips(req: VercelRequest, res: VercelResponse, ctx: { sub: number; company_id: number; role: string; name: string }) {
  const id = req.query.id ? Number(req.query.id) : null;

  if (id && req.method === 'DELETE') {
    if (!CAN_MANAGE_PAYSLIPS.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    const rows = await sql`SELECT id FROM payslips WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    if (!rows[0]) return err(res, 404, 'Holerite não encontrado');
    await sql`DELETE FROM payslips WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const canManage  = CAN_MANAGE_PAYSLIPS.includes(ctx.role);
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;

    if (canManage) {
      const rows = employeeId
        ? await sql`
            SELECT p.*, e.name AS employee_name FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            WHERE p.company_id = ${ctx.company_id} AND p.employee_id = ${employeeId}
            ORDER BY p.month DESC
          `
        : await sql`
            SELECT p.*, e.name AS employee_name FROM payslips p
            JOIN employees e ON e.id = p.employee_id
            WHERE p.company_id = ${ctx.company_id}
            ORDER BY p.month DESC LIMIT 100
          `;
      return res.json(rows);
    }

    const empRows = await sql`SELECT id FROM employees WHERE user_id = ${ctx.sub} AND company_id = ${ctx.company_id}`;
    if (!empRows[0]) return res.json([]);

    const rows = await sql`
      SELECT p.*, e.name AS employee_name FROM payslips p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.company_id = ${ctx.company_id} AND p.employee_id = ${empRows[0].id as number}
      ORDER BY p.month DESC
    `;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    if (!CAN_MANAGE_PAYSLIPS.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    const { employee_id, month, description, file_url } = req.body ?? {};

    if (!employee_id || !month || !file_url) return err(res, 400, 'employee_id, month e file_url são obrigatórios');
    if (!/^\d{4}-\d{2}$/.test(month)) return err(res, 400, 'month deve ter formato YYYY-MM');

    const emp = await sql`SELECT id FROM employees WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id}`;
    if (!emp[0]) return err(res, 404, 'Colaborador não encontrado');

    const rows = await sql`
      INSERT INTO payslips (company_id, employee_id, month, description, file_url, created_by)
      VALUES (${ctx.company_id}, ${Number(employee_id)}, ${month}, ${description ?? null}, ${file_url}, ${ctx.sub})
      ON CONFLICT (employee_id, month) DO UPDATE
        SET description = EXCLUDED.description, file_url = EXCLUDED.file_url, created_by = EXCLUDED.created_by
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}

// ── Recognitions handlers ─────────────────────────────────────

async function handleRecognitions(req: VercelRequest, res: VercelResponse, ctx: { sub: number; company_id: number; role: string; name: string }) {
  const id = req.query.id ? Number(req.query.id) : null;

  if (id && req.method === 'DELETE') {
    const isAdmin = IS_ADMIN.includes(ctx.role) || ['rh', 'adm'].includes(ctx.role);
    const rows = await sql`SELECT from_user_id FROM recognitions WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    if (!rows[0]) return err(res, 404, 'Reconhecimento não encontrado');
    if (!isAdmin && rows[0].from_user_id !== ctx.sub) return err(res, 403, 'Sem permissão');
    await sql`DELETE FROM recognitions WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const toId   = req.query.to_employee_id ? Number(req.query.to_employee_id) : null;
    const page   = Math.max(1, Number(req.query.page) || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const rows = toId
      ? await sql`
          SELECT r.*, e.role_title AS to_role FROM recognitions r
          LEFT JOIN employees e ON e.id = r.to_employee_id
          WHERE r.company_id = ${ctx.company_id} AND r.to_employee_id = ${toId}
          ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT r.*, e.role_title AS to_role FROM recognitions r
          LEFT JOIN employees e ON e.id = r.to_employee_id
          WHERE r.company_id = ${ctx.company_id}
          ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;

    const countRow = toId
      ? await sql`SELECT COUNT(*)::int AS total FROM recognitions WHERE company_id = ${ctx.company_id} AND to_employee_id = ${toId}`
      : await sql`SELECT COUNT(*)::int AS total FROM recognitions WHERE company_id = ${ctx.company_id}`;

    return res.json({ data: rows, total: countRow[0]?.total ?? 0 });
  }

  if (req.method === 'POST') {
    const { to_employee_id, message, category = 'outro' } = req.body ?? {};

    if (!to_employee_id || !message?.trim()) return err(res, 400, 'to_employee_id e message são obrigatórios');
    if (message.length > 500) return err(res, 400, 'Mensagem muito longa (máx. 500 caracteres)');
    if (!VALID_CATEGORIES.includes(category)) return err(res, 400, 'Categoria inválida');

    const emp = await sql`SELECT name FROM employees WHERE id = ${Number(to_employee_id)} AND company_id = ${ctx.company_id}`;
    if (!emp[0]) return err(res, 404, 'Colaborador não encontrado');

    const rows = await sql`
      INSERT INTO recognitions (company_id, from_user_id, from_name, to_employee_id, to_name, message, category)
      VALUES (${ctx.company_id}, ${ctx.sub}, ${ctx.name}, ${Number(to_employee_id)}, ${emp[0].name as string}, ${message.trim()}, ${category})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}

// ── Main handler ──────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: unknown) { const er = e as { status?: number; message?: string }; return err(res, er.status ?? 401, er.message ?? 'Não autorizado'); }

  if (req.query.type === 'payslips') return handlePayslips(req, res, ctx);
  return handleRecognitions(req, res, ctx);
}
