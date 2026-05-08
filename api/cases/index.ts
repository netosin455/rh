// ============================================================
// api/cases/index.ts — GET /api/cases  POST /api/cases
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { status, area, search } = req.query as Record<string, string>;

    const rows = await sql`
      SELECT
        c.*,
        e.name AS responsible_name
      FROM legal_cases c
      LEFT JOIN employees e ON e.id = c.responsible_id
      WHERE c.company_id = ${ctx.company_id}
        AND (${status ?? null} IS NULL OR c.status = ${status ?? null})
        AND (${area ?? null} IS NULL OR c.area = ${area ?? null})
        AND (
          ${search ?? null} IS NULL
          OR c.title ILIKE ${'%' + (search ?? '') + '%'}
          OR c.case_number ILIKE ${'%' + (search ?? '') + '%'}
          OR c.client_name ILIKE ${'%' + (search ?? '') + '%'}
        )
      ORDER BY
        CASE c.status WHEN 'urgente' THEN 0 ELSE 1 END,
        c.deadline ASC NULLS LAST,
        c.created_at DESC
    `;
    return res.json(rows);
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role) && !['juridico', 'gestor'].includes(ctx.role)) {
      return err(res, 403, 'Sem permissão');
    }
    const {
      case_number, title, area = 'outro', status = 'ativo',
      client_name, responsible_id, court, deadline, description,
    } = req.body ?? {};

    if (!case_number || !title || !client_name) {
      return err(res, 400, 'case_number, title e client_name são obrigatórios');
    }

    const rows = await sql`
      INSERT INTO legal_cases
        (company_id, case_number, title, area, status, client_name,
         responsible_id, court, deadline, description)
      VALUES
        (${ctx.company_id}, ${case_number}, ${title}, ${area}, ${status},
         ${client_name}, ${responsible_id ?? null}, ${court ?? null},
         ${deadline ?? null}, ${description ?? null})
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
