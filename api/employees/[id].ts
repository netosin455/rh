// ============================================================
// api/employees/[id].ts — GET PUT DELETE /api/employees/:id
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

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT e.*, d.name AS department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = ${id} AND e.company_id = ${ctx.company_id}
    `;
    if (!rows[0]) return err(res, 404, 'Colaborador não encontrado');
    return res.json(rows[0]);
  }

  // ── PUT ───────────────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!['super_admin','admin','rh'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    const {
      name, cpf, birth_date, hire_date, department_id,
      role_title, legal_area, oab_number, manager_id,
      status, photo_url, phone, salary, vacation_days,
    } = req.body ?? {};

    const rows = await sql`
      UPDATE employees SET
        name          = COALESCE(${name          ?? null}, name),
        cpf           = COALESCE(${cpf           ?? null}, cpf),
        birth_date    = COALESCE(${birth_date    ?? null}, birth_date),
        hire_date     = COALESCE(${hire_date     ?? null}, hire_date),
        department_id = COALESCE(${department_id ?? null}, department_id),
        role_title    = COALESCE(${role_title    ?? null}, role_title),
        legal_area    = COALESCE(${legal_area    ?? null}, legal_area),
        oab_number    = COALESCE(${oab_number    ?? null}, oab_number),
        manager_id    = COALESCE(${manager_id    ?? null}, manager_id),
        status        = COALESCE(${status        ?? null}, status),
        photo_url     = COALESCE(${photo_url     ?? null}, photo_url),
        phone         = COALESCE(${phone         ?? null}, phone),
        salary        = COALESCE(${salary        ?? null}, salary),
        vacation_days = COALESCE(${vacation_days ?? null}, vacation_days)
      WHERE id = ${id} AND company_id = ${ctx.company_id}
      RETURNING *
    `;
    if (!rows[0]) return err(res, 404, 'Colaborador não encontrado');
    return res.json(rows[0]);
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!['super_admin','admin','rh'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    await sql`
      DELETE FROM employees
      WHERE id = ${id} AND company_id = ${ctx.company_id}
    `;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
