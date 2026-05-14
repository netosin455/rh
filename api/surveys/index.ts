// ============================================================
// api/surveys/index.ts
// GET  /api/surveys              → listar pesquisas
// POST /api/surveys              → criar pesquisa
// GET  /api/surveys/:id          → detalhe
// GET  /api/surveys/:id/results  → resultados consolidados
// POST /api/surveys/:id/respond  → registrar resposta (sem auth — público)
// DELETE /api/surveys/:id        → excluir pesquisa
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const surveyId = req.query.id ? Number(req.query.id) : null;

  // ── POST :id/respond — PÚBLICO (sem autenticação) ─────────
  if (surveyId && req.query.respond === 'true' && req.method === 'POST') {
    const survey = await sql`
      SELECT id, company_id, type, options, expires_at
      FROM pulse_surveys WHERE id = ${surveyId}
    `;
    if (!survey[0]) return err(res, 404, 'Pesquisa não encontrada');

    if (survey[0].expires_at && new Date(survey[0].expires_at) < new Date()) {
      return err(res, 410, 'Esta pesquisa já encerrou');
    }

    const { score, choice } = req.body ?? {};
    const type = survey[0].type;

    if (type === 'scale') {
      const s = Number(score);
      if (!s || s < 1 || s > 5) return err(res, 400, 'score deve ser entre 1 e 5');
      await sql`
        INSERT INTO pulse_responses (survey_id, score)
        VALUES (${surveyId}, ${s})
      `;
    } else {
      if (!choice) return err(res, 400, 'choice é obrigatório para pesquisa de escolha');
      const opts: string[] = survey[0].options ?? [];
      if (!opts.includes(String(choice))) return err(res, 400, 'Opção inválida');
      await sql`
        INSERT INTO pulse_responses (survey_id, choice)
        VALUES (${surveyId}, ${String(choice)})
      `;
    }

    return res.status(201).json({ ok: true });
  }

  // ── Demais rotas exigem autenticação ─────────────────────
  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  // ── GET :id/results ───────────────────────────────────────
  if (surveyId && req.query.results === 'true' && req.method === 'GET') {
    const surveys = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept
      WHERE ps.id = ${surveyId} AND ps.company_id = ${ctx.company_id}
    `;
    if (!surveys[0]) return err(res, 404, 'Pesquisa não encontrada');
    const s = surveys[0];

    const responses = await sql`
      SELECT score, choice, responded_at
      FROM pulse_responses WHERE survey_id = ${surveyId}
      ORDER BY responded_at DESC
    `;

    const total = responses.length;

    let results: Record<string, any> = {};
    if (s.type === 'scale') {
      const scores = (responses as any[]).map(r => r.score).filter(Boolean);
      const avg = scores.length ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10 : 0;
      const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      scores.forEach((sc: number) => { dist[sc] = (dist[sc] ?? 0) + 1; });
      results = { avg, distribution: dist };
    } else {
      const opts: string[] = s.options ?? [];
      const dist: Record<string, number> = {};
      opts.forEach((o: string) => { dist[o] = 0; });
      (responses as any[]).forEach(r => {
        if (r.choice) dist[r.choice] = (dist[r.choice] ?? 0) + 1;
      });
      results = { distribution: dist };
    }

    return res.json({ survey: s, total_responses: total, results, recent: (responses as any[]).slice(0, 5) });
  }

  // ── GET :id ───────────────────────────────────────────────
  if (surveyId && req.method === 'GET') {
    const rows = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name,
        (SELECT COUNT(*)::int FROM pulse_responses WHERE survey_id = ps.id) AS response_count
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept
      WHERE ps.id = ${surveyId} AND ps.company_id = ${ctx.company_id}
    `;
    if (!rows[0]) return err(res, 404, 'Pesquisa não encontrada');
    return res.json(rows[0]);
  }

  // ── DELETE :id ────────────────────────────────────────────
  if (surveyId && req.method === 'DELETE') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    await sql`DELETE FROM pulse_surveys WHERE id = ${surveyId} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  // ── GET /api/surveys — listar ─────────────────────────────
  if (!surveyId && req.method === 'GET') {
    const rows = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name,
        (SELECT COUNT(*)::int FROM pulse_responses WHERE survey_id = ps.id) AS response_count
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept
      WHERE ps.company_id = ${ctx.company_id}
      ORDER BY ps.created_at DESC
      LIMIT 50
    `;
    return res.json(rows);
  }

  // ── POST /api/surveys — criar ─────────────────────────────
  if (!surveyId && req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');

    const { title, question, type = 'scale', options, target_dept, expires_at } = req.body ?? {};
    if (!title || !question) return err(res, 400, 'title e question são obrigatórios');
    if (!['scale', 'choice'].includes(type)) return err(res, 400, 'type deve ser scale ou choice');
    if (type === 'choice' && (!Array.isArray(options) || options.length < 2)) {
      return err(res, 400, 'Pesquisa de escolha precisa de ao menos 2 opções');
    }

    const rows = await sql`
      INSERT INTO pulse_surveys (company_id, created_by, title, question, type, options, target_dept, expires_at)
      VALUES (
        ${ctx.company_id}, ${ctx.sub}, ${title}, ${question}, ${type},
        ${type === 'choice' ? JSON.stringify(options) : null},
        ${target_dept ? Number(target_dept) : null},
        ${expires_at ?? null}
      )
      RETURNING *
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
