// ============================================================
// api/employees/index.ts — GET/POST /api/employees | GET/PUT/DELETE /api/employees/:id
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, parsePagination } from '../_lib';
import { validarCPF } from '../../helpers/validacoes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const id = req.query.id ? Number(req.query.id) : null;

  // ── Item routes /:id ──────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT e.*,
          d.name AS department_name,
          CASE
            WHEN e.status IN ('desligado', 'afastado') THEN e.status
            WHEN EXISTS (
              SELECT 1 FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type = 'ferias'
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
            ) THEN 'ferias'
            ELSE (
              SELECT a.type FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type IN ('licenca_medica','licenca_maternidade','licenca_paternidade')
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
              ORDER BY a.start_date DESC LIMIT 1
            )
          END AS status
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.id = ${id} AND e.company_id = ${ctx.company_id} AND e.deleted_at IS NULL
      `;
      if (!rows[0]) return err(res, 404, 'Colaborador não encontrado');
      if (!rows[0].status) rows[0].status = 'ativo';
      return res.json(rows[0]);
    }

    if (req.method === 'PUT') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      const {
        name, cpf, birth_date, hire_date, department_id,
        role_title, legal_area, oab_number, manager_id,
        status, photo_url, phone, salary, vacation_days, folga_hours,
        folga_hours_delta,
      } = req.body ?? {};

      if (cpf && !validarCPF(cpf)) {
        return err(res, 422, 'CPF inválido. Verifique os dígitos informados.');
      }
      if (folga_hours_delta != null && !Number.isFinite(Number(folga_hours_delta))) {
        return err(res, 400, 'folga_hours_delta deve ser um número');
      }

      // Registrar histórico se salário foi alterado
      if (salary != null) {
        const current = await sql`
          SELECT salary FROM employees WHERE id = ${id} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
        `;
        if (current[0] && String(current[0].salary) !== String(salary)) {
          await sql`
            INSERT INTO salary_history (company_id, employee_id, old_salary, new_salary, changed_by)
            VALUES (${ctx.company_id}, ${id}, ${current[0].salary ?? null}, ${salary}, ${ctx.sub})
          `.catch(() => {});
        }
      }

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
          vacation_days = COALESCE(${vacation_days ?? null}, vacation_days),
          folga_hours   = CASE
            WHEN ${folga_hours_delta ?? null}::numeric IS NOT NULL
              THEN GREATEST(0, folga_hours + ${folga_hours_delta ?? null}::numeric)
            ELSE COALESCE(${folga_hours ?? null}, folga_hours)
          END
        WHERE id = ${id} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
        RETURNING *
      `;
      if (!rows[0]) return err(res, 404, 'Colaborador não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (!['super_admin', 'admin'].includes(ctx.role)) return err(res, 403, 'Sem permissão');
      // Soft-delete: preserva histórico e dados associados
      const deleted = await sql`
        UPDATE employees SET deleted_at = now()
        WHERE id = ${id} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (!deleted[0]) return err(res, 404, 'Colaborador não encontrado');
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Collection routes ─────────────────────────────────────
  if (req.method === 'GET') {
    const { page, limit, offset } = parsePagination(req.query);

    const [countRow, rows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM employees WHERE company_id = ${ctx.company_id} AND deleted_at IS NULL`,
      sql`
        SELECT e.*,
          d.name AS department_name,
          CASE
            WHEN e.status IN ('desligado', 'afastado') THEN e.status
            WHEN EXISTS (
              SELECT 1 FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type = 'ferias'
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
            ) THEN 'ferias'
            ELSE (
              SELECT a.type FROM absences a
              WHERE a.employee_id = e.id AND a.status = 'aprovado'
                AND a.type IN ('licenca_medica','licenca_maternidade','licenca_paternidade')
                AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
              ORDER BY a.start_date DESC LIMIT 1
            )
          END AS status
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.company_id = ${ctx.company_id} AND e.deleted_at IS NULL
        ORDER BY e.name
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = countRow[0]?.total ?? 0;
    for (const row of rows as any[]) { if (!row.status) row.status = 'ativo'; }
    return res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    const {
      name, cpf, birth_date, hire_date, department_id,
      role_title, legal_area, oab_number, manager_id,
      status = 'ativo', photo_url, phone, salary, vacation_days = 30, folga_hours = 0,
    } = req.body ?? {};

    if (!name || !hire_date || !role_title) {
      return err(res, 400, 'name, hire_date e role_title são obrigatórios');
    }
    if (cpf && !validarCPF(cpf)) {
      return err(res, 422, 'CPF inválido. Verifique os dígitos informados.');
    }

    const rows = await sql`
      INSERT INTO employees
        (company_id, name, cpf, birth_date, hire_date, department_id,
         role_title, legal_area, oab_number, manager_id, status,
         photo_url, phone, salary, vacation_days, folga_hours)
      VALUES
        (${ctx.company_id}, ${name}, ${cpf ?? null}, ${birth_date ?? null},
         ${hire_date}, ${department_id ?? null}, ${role_title},
         ${legal_area ?? null}, ${oab_number ?? null}, ${manager_id ?? null},
         ${status}, ${photo_url ?? null}, ${phone ?? null},
         ${salary ?? null}, ${vacation_days}, ${folga_hours})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
