// GET/POST /api/feedbacks; GET/PUT /api/feedbacks/:id; POST :id/publish|revoke

import { randomBytes } from 'node:crypto';
import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { CAN_MANAGE_EMPLOYEES, cors, authenticate, err, sql, type JWTPayload } from '../_lib';

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

function canManage(ctx: JWTPayload): boolean {
  return CAN_MANAGE_EMPLOYEES.includes(ctx.role);
}

async function employeeBelongsToCompany(employeeId: number, companyId: number): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM employees WHERE id = ${employeeId} AND company_id = ${companyId} AND deleted_at IS NULL
  `;
  return Boolean(rows[0]);
}

async function findManagedFeedback(id: number, companyId: number) {
  const rows = await sql`
    SELECT f.*, e.name AS employee_name, u.name AS created_by_name
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    LEFT JOIN users u ON u.id = f.created_by AND u.company_id = f.company_id
    WHERE f.id = ${id} AND f.company_id = ${companyId}
  `;
  return rows[0] ?? null;
}

async function handleList(req: VercelRequest, res: VercelResponse, ctx: JWTPayload) {
  const requestedStatus = req.query.status;
  if (requestedStatus && !['draft', 'published', 'acknowledged', 'revoked'].includes(String(requestedStatus))) {
    return err(res, 400, 'status inválido');
  }
  const rows = await sql`
    SELECT f.*, e.name AS employee_name, u.name AS created_by_name
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    LEFT JOIN users u ON u.id = f.created_by AND u.company_id = f.company_id
    WHERE f.company_id = ${ctx.company_id}
      AND (${requestedStatus ? String(requestedStatus) : null}::text IS NULL OR f.status = ${requestedStatus ? String(requestedStatus) : null})
    ORDER BY f.created_at DESC
    LIMIT 100
  `;
  return res.json(rows);
}

async function handleCreate(req: VercelRequest, res: VercelResponse, ctx: JWTPayload) {
  const input = parseInput(req.body);
  if (!isInput(input)) return err(res, 400, input.error);
  if (!await employeeBelongsToCompany(input.employee_id, ctx.company_id)) return err(res, 404, 'Colaborador não encontrado');
  const rows = await sql`
    INSERT INTO feedbacks (company_id, employee_id, created_by, title, content)
    VALUES (${ctx.company_id}, ${input.employee_id}, ${ctx.sub}, ${input.title}, ${input.content})
    RETURNING *
  `;
  return res.status(201).json(rows[0]);
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, ctx: JWTPayload, id: number) {
  const input = parseInput(req.body);
  if (!isInput(input)) return err(res, 400, input.error);
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (current.status !== 'draft') return err(res, 409, 'Apenas rascunhos podem ser editados');
  if (!await employeeBelongsToCompany(input.employee_id, ctx.company_id)) return err(res, 404, 'Colaborador não encontrado');
  const rows = await sql`
    UPDATE feedbacks SET employee_id = ${input.employee_id}, title = ${input.title}, content = ${input.content}
    WHERE id = ${id} AND company_id = ${ctx.company_id} AND status = 'draft'
    RETURNING *
  `;
  return res.json(rows[0]);
}

async function publishFeedback(id: number, companyId: number) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = randomBytes(32).toString('base64url');
      const rows = await sql`
        UPDATE feedbacks SET public_token = ${token}, status = 'published', published_at = now()
        WHERE id = ${id} AND company_id = ${companyId} AND status = 'draft'
        RETURNING *
      `;
      return rows[0] ?? null;
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== '23505') throw error;
    }
  }
  throw new Error('Não foi possível gerar um token único');
}

async function handlePublish(res: VercelResponse, ctx: JWTPayload, id: number) {
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (current.status !== 'draft') return err(res, 409, 'Feedback já foi publicado ou encerrado');
  const published = await publishFeedback(id, ctx.company_id);
  if (!published) return err(res, 409, 'O feedback não está mais disponível para publicação');
  return res.json(published);
}

async function handleRevoke(res: VercelResponse, ctx: JWTPayload, id: number) {
  const current = await findManagedFeedback(id, ctx.company_id);
  if (!current) return err(res, 404, 'Feedback não encontrado');
  if (!['published', 'acknowledged'].includes(current.status as FeedbackStatus)) return err(res, 409, 'Somente feedback publicado pode ser revogado');
  const rows = await sql`
    UPDATE feedbacks SET status = 'revoked', revoked_at = now()
    WHERE id = ${id} AND company_id = ${ctx.company_id} AND status IN ('published', 'acknowledged')
    RETURNING *
  `;
  return res.json(rows[0]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  let ctx: JWTPayload;
  try { ctx = authenticate(req); } catch (error: unknown) { const e = error as { status?: number; message?: string }; return err(res, e.status ?? 401, e.message ?? 'Não autorizado'); }
  if (!canManage(ctx)) return err(res, 403, 'Sem permissão');
  const id = feedbackId(req.query.id);
  if (req.query.id && !id) return err(res, 400, 'id inválido');
  if (!id && req.method === 'GET') return handleList(req, res, ctx);
  if (!id && req.method === 'POST') return handleCreate(req, res, ctx);
  if (id && req.method === 'GET') { const feedback = await findManagedFeedback(id, ctx.company_id); return feedback ? res.json(feedback) : err(res, 404, 'Feedback não encontrado'); }
  if (id && req.method === 'PUT') return handleUpdate(req, res, ctx, id);
  if (id && req.method === 'POST' && req.query.action === 'publish') return handlePublish(res, ctx, id);
  if (id && req.method === 'POST' && req.query.action === 'revoke') return handleRevoke(res, ctx, id);
  return err(res, 405, 'Método não permitido');
}
