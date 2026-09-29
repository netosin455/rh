import { randomBytes } from 'node:crypto';
import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { CAN_MANAGE_EMPLOYEES, authenticate, err, sql, type JWTPayload } from '../_lib';
import { createFeedbackPdf } from './_pdf';
import { findPublicFeedback, isFeedbackToken, type PublicFeedbackRow } from './_public';

type FeedbackInput = { employee_id: number; title: string; content: string };
type FeedbackStatus = 'draft' | 'published' | 'acknowledged' | 'revoked';

function feedbackId(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseInput(body: unknown): FeedbackInput | { error: string } {
  const value = body as Partial<FeedbackInput> | null;
  const employeeId = Number(value?.employee_id);
  const title = typeof value?.title === 'string' ? value.title.trim() : '';
  const content = typeof value?.content === 'string' ? value.content.trim() : '';
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) return { error: 'colaborador é obrigatório' };
  if (!title || title.length > 140) return { error: 'título deve ter entre 1 e 140 caracteres' };
  if (!content || content.length > 10000) return { error: 'texto deve ter entre 1 e 10000 caracteres' };
  return { employee_id: employeeId, title, content };
}

function isInput(value: FeedbackInput | { error: string }): value is FeedbackInput {
  return !('error' in value);
}

async function employeeBelongsToCompany(employeeId: number, companyId: number): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM employees WHERE id = ${employeeId} AND company_id = ${companyId} AND deleted_at IS NULL
  `;
  return Boolean(rows[0]);
}

async function findManagedFeedback(id: number, companyId: number) {
  const rows = await sql`
    SELECT f.*, e.name AS employee_name, e.role_title AS employee_role_title,
      d.name AS employee_department_name, u.name AS created_by_name, u.role AS created_by_role
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    LEFT JOIN departments d ON d.id = e.department_id AND d.company_id = e.company_id
    LEFT JOIN users u ON u.id = f.created_by AND u.company_id = f.company_id
    WHERE f.id = ${id} AND f.company_id = ${companyId}
  `;
  return rows[0] ?? null;
}

async function listFeedbacks(req: VercelRequest, res: VercelResponse, ctx: JWTPayload) {
  const requestedStatus = req.query.status;
  if (requestedStatus && !['draft', 'published', 'acknowledged', 'revoked'].includes(String(requestedStatus))) return err(res, 400, 'status inválido');
  const rows = await sql`
    SELECT f.*, e.name AS employee_name, e.role_title AS employee_role_title,
      d.name AS employee_department_name, u.name AS created_by_name, u.role AS created_by_role
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    LEFT JOIN departments d ON d.id = e.department_id AND d.company_id = e.company_id
    LEFT JOIN users u ON u.id = f.created_by AND u.company_id = f.company_id
    WHERE f.company_id = ${ctx.company_id}
      AND (${requestedStatus ? String(requestedStatus) : null}::text IS NULL OR f.status = ${requestedStatus ? String(requestedStatus) : null})
    ORDER BY f.created_at DESC LIMIT 100
  `;
  return res.json(rows);
}

async function createFeedback(req: VercelRequest, res: VercelResponse, ctx: JWTPayload) {
  const input = parseInput(req.body);
  if (!isInput(input)) return err(res, 400, input.error);
  if (!await employeeBelongsToCompany(input.employee_id, ctx.company_id)) return err(res, 404, 'Colaborador não encontrado');
  const rows = await sql`
    INSERT INTO feedbacks (company_id, employee_id, created_by, title, content)
    VALUES (${ctx.company_id}, ${input.employee_id}, ${ctx.sub}, ${input.title}, ${input.content}) RETURNING *
  `;
  return res.status(201).json(rows[0]);
}

async function updateFeedback(req: VercelRequest, res: VercelResponse, ctx: JWTPayload, id: number) {
  const input = parseInput(req.body);
  if (!isInput(input)) return err(res, 400, input.error);
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (current.status !== 'draft') return err(res, 409, 'Apenas rascunhos podem ser editados');
  if (!await employeeBelongsToCompany(input.employee_id, ctx.company_id)) return err(res, 404, 'Colaborador não encontrado');
  const rows = await sql`
    UPDATE feedbacks SET employee_id = ${input.employee_id}, title = ${input.title}, content = ${input.content}
    WHERE id = ${id} AND company_id = ${ctx.company_id} AND status = 'draft' RETURNING *
  `;
  return res.json(rows[0]);
}

async function publishFeedback(id: number, companyId: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = randomBytes(32).toString('base64url');
      const rows = await sql`
        UPDATE feedbacks SET public_token = ${token}, status = 'published', published_at = now()
        WHERE id = ${id} AND company_id = ${companyId} AND status = 'draft' RETURNING *
      `;
      return rows[0] ?? null;
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== '23505') throw error;
    }
  }
  throw new Error('Não foi possível gerar um token único');
}

async function publish(res: VercelResponse, ctx: JWTPayload, id: number) {
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (current.status !== 'draft') return err(res, 409, 'Feedback já foi publicado ou encerrado');
  const published = await publishFeedback(id, ctx.company_id);
  return published ? res.json(published) : err(res, 409, 'O feedback não está mais disponível para publicação');
}

async function revoke(res: VercelResponse, ctx: JWTPayload, id: number) {
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (!['published', 'acknowledged'].includes(current.status as FeedbackStatus)) return err(res, 409, 'Somente feedback publicado pode ser revogado');
  const rows = await sql`
    UPDATE feedbacks SET status = 'revoked', revoked_at = now()
    WHERE id = ${id} AND company_id = ${ctx.company_id} AND status IN ('published', 'acknowledged') RETURNING *
  `;
  return res.json(rows[0]);
}

/** Compartilhado por `api/recognitions/index.ts` para não exceder o limite de funções no Hobby. */
export async function handleFeedbackAdmin(req: VercelRequest, res: VercelResponse) {
  let ctx: JWTPayload;
  try { ctx = authenticate(req); } catch (error: unknown) { const e = error as { status?: number; message?: string }; return err(res, e.status ?? 401, e.message ?? 'Não autorizado'); }
  if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
  const id = feedbackId(req.query.id);
  if (req.query.id && !id) return err(res, 400, 'id inválido');
  if (!id && req.method === 'GET') return listFeedbacks(req, res, ctx);
  if (!id && req.method === 'POST') return createFeedback(req, res, ctx);
  if (id && req.method === 'GET') { const feedback = await findManagedFeedback(id, ctx.company_id); return feedback ? res.json(feedback) : err(res, 404, 'Feedback não encontrado'); }
  if (id && req.method === 'PUT') return updateFeedback(req, res, ctx, id);
  if (id && req.method === 'POST' && req.query.action === 'publish') return publish(res, ctx, id);
  if (id && req.method === 'POST' && req.query.action === 'revoke') return revoke(res, ctx, id);
  return err(res, 405, 'Método não permitido');
}

function privateResponse(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function publicResponse(row: PublicFeedbackRow) {
  return {
    title: row.title, content: row.content, employee_name: row.employee_name, company_name: row.company_name,
    employee_role_title: row.employee_role_title, employee_department_name: row.employee_department_name,
    created_by_name: row.created_by_name, created_by_role: row.created_by_role,
    status: row.status, published_at: row.published_at, acknowledged_at: row.acknowledged_at,
  };
}

async function activeFeedback(res: VercelResponse, token: string): Promise<PublicFeedbackRow | null> {
  const feedback = await findPublicFeedback(token);
  if (!feedback || !['published', 'acknowledged', 'revoked'].includes(feedback.status)) { err(res, 404, 'Feedback não encontrado'); return null; }
  if (feedback.status === 'revoked') { err(res, 410, 'Este link de feedback foi revogado'); return null; }
  return feedback;
}

async function acknowledge(res: VercelResponse, token: string, body: unknown) {
  if ((body as { acknowledged?: unknown } | null)?.acknowledged !== true) return err(res, 400, 'Confirmação de leitura obrigatória');
  const feedback = await activeFeedback(res, token);
  if (!feedback) return;
  if (feedback.status === 'acknowledged') return res.json({ acknowledged_at: feedback.acknowledged_at, already_acknowledged: true });
  const rows = await sql`
    UPDATE feedbacks SET status = 'acknowledged', acknowledged_at = now()
    WHERE public_token = ${token} AND status = 'published' AND acknowledged_at IS NULL RETURNING acknowledged_at
  `;
  if (rows[0]) return res.json({ acknowledged_at: rows[0].acknowledged_at, already_acknowledged: false });
  const current = await activeFeedback(res, token);
  if (current?.status === 'acknowledged') return res.json({ acknowledged_at: current.acknowledged_at, already_acknowledged: true });
}

async function downloadPdf(res: VercelResponse, token: string) {
  const feedback = await activeFeedback(res, token);
  if (!feedback) return;
  const bytes = await createFeedbackPdf(feedback);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="feedback.pdf"');
  return res.status(200).send(Buffer.from(bytes));
}

/** Rota pública sem JWT, despachada antes da autenticação do handler de Reconhecimentos. */
export async function handleFeedbackPublic(req: VercelRequest, res: VercelResponse) {
  privateResponse(res);
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!isFeedbackToken(token)) return err(res, 404, 'Feedback não encontrado');
  if (req.method === 'GET' && req.query.action === 'pdf') return downloadPdf(res, token);
  if (req.method === 'POST' && req.query.action === 'acknowledge') return acknowledge(res, token, req.body);
  if (req.method === 'GET') { const feedback = await activeFeedback(res, token); return feedback ? res.json(publicResponse(feedback)) : undefined; }
  return err(res, 405, 'Método não permitido');
}
