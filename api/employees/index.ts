// ============================================================
// api/employees/index.ts — GET /api/employees  POST /api/employees
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT e.*, d.name AS department_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.company_id = ${ctx.company_id}
      ORDER BY e.name
    `;
    return res.json(rows);
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!['super_admin','admin','rh'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    const {
      name, cpf, birth_date, hire_date, department_id,
      role_title, legal_area, oab_number, manager_id,
      status = 'ativo', photo_url, phone, salary, vacation_days = 30,
    } = req.body ?? {};

    if (!name || !hire_date || !role_title) {
      return err(res, 400, 'name, hire_date e role_title são obrigatórios');
    }

    const rows = await sql`
      INSERT INTO employees
        (company_id, name, cpf, birth_date, hire_date, department_id,
         role_title, legal_area, oab_number, manager_id, status,
         photo_url, phone, salary, vacation_days)
      VALUES
        (${ctx.company_id}, ${name}, ${cpf ?? null}, ${birth_date ?? null},
         ${hire_date}, ${department_id ?? null}, ${role_title},
         ${legal_area ?? null}, ${oab_number ?? null}, ${manager_id ?? null},
         ${status}, ${photo_url ?? null}, ${phone ?? null},
         ${salary ?? null}, ${vacation_days})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
