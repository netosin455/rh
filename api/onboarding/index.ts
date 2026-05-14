// ============================================================
// api/onboarding/index.ts
//
// GET  /api/onboarding                    → processos ativos
// POST /api/onboarding                    → iniciar onboarding
// GET  /api/onboarding/:id                → processo detalhe
// PATCH /api/onboarding/:id/step          → marcar etapa concluída
// DELETE /api/onboarding/:id              → encerrar/cancelar
// GET  /api/onboarding/templates          → listar templates
// POST /api/onboarding/templates          → criar template
// DELETE /api/onboarding/templates/:tid   → excluir template
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const cid = ctx.company_id;
  const id  = req.query.id  ? Number(req.query.id)  : null;
  const tid = req.query.tid ? Number(req.query.tid) : null;

  // ── Templates ─────────────────────────────────────────────

  if (req.query.templates === 'true') {

    if (tid && req.method === 'DELETE') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      await sql`DELETE FROM onboarding_templates WHERE id = ${tid} AND company_id = ${cid}`;
      return res.status(204).end();
    }

    if (!tid && req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM onboarding_templates
        WHERE company_id = ${cid}
        ORDER BY is_default DESC, name ASC
      `;
      return res.json(rows);
    }

    if (!tid && req.method === 'POST') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      const { name, steps, is_default = false } = req.body ?? {};
      if (!name || !Array.isArray(steps) || steps.length === 0) {
        return err(res, 400, 'name e steps (array) são obrigatórios');
      }
      if (is_default) {
        await sql`UPDATE onboarding_templates SET is_default = false WHERE company_id = ${cid}`;
      }
      const rows = await sql`
        INSERT INTO onboarding_templates (company_id, name, steps, is_default)
        VALUES (${cid}, ${name}, ${JSON.stringify(steps)}, ${is_default})
        RETURNING *
      `;
      return res.status(201).json(rows[0]);
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Processos — com :id ───────────────────────────────────

  if (id) {

    // PATCH :id/step — marcar etapa
    if (req.query.step === 'true' && req.method === 'PATCH') {
      const { step_index, completed } = req.body ?? {};
      if (step_index === undefined || typeof completed !== 'boolean') {
        return err(res, 400, 'step_index e completed são obrigatórios');
      }

      const proc = await sql`
        SELECT id, steps_snapshot, steps_progress, completed_at
        FROM onboarding_processes WHERE id = ${id} AND company_id = ${cid}
      `;
      if (!proc[0]) return err(res, 404, 'Processo não encontrado');
      if (proc[0].completed_at) return err(res, 400, 'Onboarding já foi concluído');

      const progress: Record<string, any> = proc[0].steps_progress ?? {};
      const snapshot: any[] = proc[0].steps_snapshot ?? [];

      progress[String(step_index)] = completed
        ? { completed: true, completed_at: new Date().toISOString(), completed_by: ctx.name }
        : { completed: false };

      const allDone = snapshot.every((_: any, i: number) => progress[String(i)]?.completed);

      const rows = await sql`
        UPDATE onboarding_processes SET
          steps_progress = ${JSON.stringify(progress)},
          completed_at   = ${allDone ? new Date().toISOString() : null}
        WHERE id = ${id} AND company_id = ${cid}
        RETURNING *
      `;
      return res.json(rows[0]);
    }

    // GET :id — detalhe
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT op.*,
          e.name AS employee_name, e.role_title, e.department_id,
          d.name AS department_name
        FROM onboarding_processes op
        JOIN employees e ON e.id = op.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE op.id = ${id} AND op.company_id = ${cid}
      `;
      if (!rows[0]) return err(res, 404, 'Processo não encontrado');
      return res.json(rows[0]);
    }

    // DELETE :id
    if (req.method === 'DELETE') {
      if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
      await sql`DELETE FROM onboarding_processes WHERE id = ${id} AND company_id = ${cid}`;
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Processos — coleção ───────────────────────────────────

  if (req.method === 'GET') {
    const { active_only } = req.query;
    const rows = await sql`
      SELECT op.*,
        e.name AS employee_name, e.role_title,
        d.name AS department_name
      FROM onboarding_processes op
      JOIN employees e ON e.id = op.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE op.company_id = ${cid}
        AND (${active_only !== 'true'}::bool OR op.completed_at IS NULL)
      ORDER BY op.started_at DESC
      LIMIT 50
    `;
    return res.json(rows);
  }

  if (req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');

    const { employee_id, template_id } = req.body ?? {};
    if (!employee_id) return err(res, 400, 'employee_id é obrigatório');

    const emp = await sql`
      SELECT id, name FROM employees WHERE id = ${Number(employee_id)} AND company_id = ${cid}
    `;
    if (!emp[0]) return err(res, 404, 'Colaborador não encontrado');

    // Busca template (passado ou padrão)
    let template;
    if (template_id) {
      const t = await sql`SELECT * FROM onboarding_templates WHERE id = ${Number(template_id)} AND company_id = ${cid}`;
      template = t[0];
    } else {
      const t = await sql`
        SELECT * FROM onboarding_templates
        WHERE company_id = ${cid}
        ORDER BY is_default DESC, id ASC LIMIT 1
      `;
      template = t[0];
    }
    if (!template) return err(res, 400, 'Nenhum template de onboarding encontrado. Crie um primeiro.');

    // Remove processo anterior se houver
    await sql`DELETE FROM onboarding_processes WHERE employee_id = ${Number(employee_id)}`;

    const rows = await sql`
      INSERT INTO onboarding_processes
        (company_id, employee_id, template_id, template_name, steps_snapshot, steps_progress)
      VALUES
        (${cid}, ${Number(employee_id)}, ${template.id}, ${template.name},
         ${JSON.stringify(template.steps)}, '{}')
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
