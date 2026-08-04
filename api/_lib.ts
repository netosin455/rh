// ============================================================
// api/_lib.ts — SuperRH
// Utilitários compartilhados: DB, JWT, CORS
// ============================================================

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { Request as VercelRequest, Response as VercelResponse } from 'express';

export const sql = neon(process.env.DATABASE_URL!);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
export const JWT_SECRET = process.env.JWT_SECRET;

export interface JWTPayload {
  sub: number;         // user.id
  company_id: number;
  role: string;
  name: string;
  email: string;
}

/** Adiciona headers CORS em todas as respostas */
export function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

/** Valida o Bearer token e retorna o payload. Lança erro se inválido. */
export function authenticate(req: VercelRequest): JWTPayload {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Não autorizado'), { status: 401 });
  }
  try {
    // Fixa o algoritmo esperado (HS256, o mesmo do jwt.sign): sem isso, um token
    // forjado com "alg":"none" seria aceito, permitindo bypass de autenticação.
    return jwt.verify(auth.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JWTPayload;
  } catch {
    throw Object.assign(new Error('Token inválido ou expirado'), { status: 401 });
  }
}

/** Atalho para respostas de erro JSON */
export function err(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

/** Papéis com permissão de gerenciar colaboradores */
export const CAN_MANAGE_EMPLOYEES = ['super_admin', 'admin', 'rh', 'adm'];

/** Papéis com permissão de aprovar férias/ausências */
export const CAN_APPROVE_ABSENCES = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];

/** Papéis com acesso administrativo geral */
export const IS_ADMIN = ['super_admin', 'admin'];

/** Todos os cargos válidos do sistema */
export const VALID_ROLES = ['super_admin','admin','rh','gestor','colaborador','financeiro','juridico','ti','adm'] as const;
export type SystemRole = typeof VALID_ROLES[number];

/** Envia push notifications via Expo Push API (gratuito, sem conta) */
export async function sendPush(
  tokens: string[],
  title:  string,
  body:   string,
  data?:  Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map(to => ({ to, title, body, data: data ?? {}, sound: 'default' }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(messages),
    });
  } catch (e: unknown) {
    console.error(`[${new Date().toISOString()}] [ERROR] sendPush:`, e);
  }
}

/** Extrai e normaliza parâmetros de paginação de query strings */
export function parsePagination(
  query: Record<string, unknown>,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number; offset: number } {
  const { defaultLimit = 50, maxLimit = 100 } = opts;
  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export const ABSENCE_VALID_TYPES = ['ferias','licenca_medica','licenca_maternidade','licenca_paternidade','folga','falta','outro'];

function absenceTypeLabel(type: string): string {
  return type === 'ferias' ? 'Férias'
    : type === 'licenca_medica' ? 'Licença Médica'
    : type === 'licenca_maternidade' ? 'Lic. Maternidade'
    : type === 'licenca_paternidade' ? 'Lic. Paternidade'
    : type === 'folga' ? 'Folga'
    : type === 'falta' ? 'Falta'
    : 'Ausência';
}

export interface CreateAbsenceInput {
  employee_id: number;
  type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  attachment_url?: string;
  hours?: number;
}

export type CreateAbsenceResult =
  | { ok: true; status: number; absence: any }
  | { ok: false; status: number; error: string };

/**
 * Cria um lançamento de ausência (férias/licença/folga/falta) com toda a validação
 * de negócio: saldo de férias/banco de horas, sobreposição de período, e — quando
 * quem está criando já tem permissão de aprovar (RH/admin/gestor) — auto-aprovação
 * com desconto de saldo na hora, já que a própria RH está confirmando o fato.
 * Usada tanto por POST /api/absences quanto pelas ações do assistente de IA no chat,
 * pra manter as duas portas de entrada com exatamente a mesma regra.
 */
export async function createAbsenceRecord(
  ctx: JWTPayload,
  input: CreateAbsenceInput,
): Promise<CreateAbsenceResult> {
  const { employee_id, type, start_date, end_date, reason, attachment_url, hours } = input;

  if (!employee_id || !start_date || !end_date) {
    return { ok: false, status: 400, error: 'employee_id, start_date e end_date são obrigatórios' };
  }
  if (!ABSENCE_VALID_TYPES.includes(type)) {
    return { ok: false, status: 400, error: `Tipo inválido. Use: ${ABSENCE_VALID_TYPES.join(', ')}` };
  }

  // Horas: registra a duração pra folga (desconta do banco) e falta (só registro,
  // útil pra quem não trabalha 8h/dia — ex: estagiário de 6h — sem mexer em saldo nenhum)
  const HOURS_TYPES = ['folga', 'falta'];
  const hoursRequested: number | null = HOURS_TYPES.includes(type) && hours != null ? Number(hours) : null;
  if (hoursRequested != null && (!Number.isFinite(hoursRequested) || hoursRequested <= 0)) {
    return { ok: false, status: 400, error: 'hours deve ser um número maior que zero' };
  }

  const empCheck = await sql`
    SELECT id, name, user_id, vacation_days, folga_hours FROM employees
    WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
  `;
  if (!empCheck[0]) return { ok: false, status: 404, error: 'Funcionário não encontrado' };
  const emp = empCheck[0] as any;

  const msPerDay = 86_400_000;
  const daysRequested = Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / msPerDay) + 1;

  if (type === 'ferias' && daysRequested > emp.vacation_days) {
    return { ok: false, status: 422, error: `Saldo insuficiente. ${emp.name} tem ${emp.vacation_days} dia(s) disponível(is), mas foram solicitados ${daysRequested}.` };
  }
  if (type === 'folga' && hoursRequested != null && hoursRequested > Number(emp.folga_hours)) {
    return { ok: false, status: 422, error: `Saldo insuficiente. ${emp.name} tem ${emp.folga_hours}h de folga disponível(is), mas foram solicitadas ${hoursRequested}h.` };
  }

  const overlap = await sql`
    SELECT id FROM absences
    WHERE employee_id = ${Number(employee_id)}
      AND status NOT IN ('recusado', 'cancelado')
      AND start_date <= ${end_date}
      AND end_date   >= ${start_date}
  `;
  if (overlap[0]) {
    return { ok: false, status: 409, error: 'O colaborador já possui uma ausência registrada neste período.' };
  }

  const autoApprove = CAN_APPROVE_ABSENCES.includes(ctx.role);

  const rows = autoApprove
    ? await sql`
        INSERT INTO absences
          (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours, status, approved_by, approved_at)
        VALUES
          (${ctx.company_id}, ${Number(employee_id)}, ${type}, ${start_date}, ${end_date},
           ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested}, 'aprovado', ${ctx.sub}, now())
        RETURNING *
      `
    : await sql`
        INSERT INTO absences
          (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours)
        VALUES
          (${ctx.company_id}, ${Number(employee_id)}, ${type}, ${start_date}, ${end_date},
           ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested})
        RETURNING *
      `;

  const typeLabel = absenceTypeLabel(type);
  const qtyLabel = hoursRequested != null ? `${hoursRequested}h` : `${daysRequested} dia${daysRequested > 1 ? 's' : ''}`;

  if (autoApprove) {
    if (type === 'ferias') {
      await sql`
        UPDATE employees SET vacation_days = GREATEST(0, vacation_days - ${daysRequested})
        WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    } else if (type === 'folga' && hoursRequested != null) {
      await sql`
        UPDATE employees SET folga_hours = GREATEST(0, folga_hours - ${hoursRequested})
        WHERE id = ${Number(employee_id)} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    }

    if (emp.user_id) {
      const notifTitle = `${typeLabel} registrada`;
      const notifBody  = `Sua ${typeLabel.toLowerCase()} de ${start_date} a ${end_date} foi registrada pela RH (${qtyLabel}).`;
      await sql`
        INSERT INTO notifications (company_id, user_id, title, body, type, route)
        VALUES (${ctx.company_id}, ${emp.user_id}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
      `.catch(() => {});
      const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${emp.user_id}`.catch(() => []);
      await sendPush((tokens as any[]).map(t => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
    }
  } else {
    const rhUsers = await sql`
      SELECT u.id FROM users u
      WHERE u.company_id = ${ctx.company_id}
        AND u.role IN ('super_admin', 'admin', 'rh')
        AND u.id != ${ctx.sub}
    `.catch(() => []);

    const notifTitle = `Nova solicitação de ${typeLabel}`;
    const notifBody  = `${emp.name} solicitou ${typeLabel.toLowerCase()} de ${start_date} a ${end_date} (${qtyLabel})`;

    for (const u of rhUsers as any[]) {
      await sql`
        INSERT INTO notifications (company_id, user_id, title, body, type, route)
        VALUES (${ctx.company_id}, ${u.id}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
      `.catch(() => {});
      const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${u.id}`.catch(() => []);
      await sendPush((tokens as any[]).map(t => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
    }
  }

  return { ok: true, status: 201, absence: rows[0] };
}

export type ResolveApprovalResult =
  | { ok: true; status: number; absence: any }
  | { ok: false; status: number; error: string };

/**
 * Aprova ou recusa uma solicitação de ausência pendente: desconta/restaura saldo
 * (vacation_days ou folga_hours) e notifica o colaborador. Compartilhada entre
 * PATCH /api/absences/:id e as ações do assistente de IA no chat.
 */
export async function resolveAbsenceApproval(
  ctx: JWTPayload,
  absenceId: number,
  approved: boolean,
): Promise<ResolveApprovalResult> {
  if (!CAN_APPROVE_ABSENCES.includes(ctx.role)) {
    return { ok: false, status: 403, error: 'Sem permissão para aprovar/recusar ausências' };
  }

  const newStatus = approved ? 'aprovado' : 'recusado';

  const existing = await sql`
    SELECT type, days_count, hours, status, employee_id
    FROM absences WHERE id = ${absenceId} AND company_id = ${ctx.company_id}
  `;
  if (!existing[0]) return { ok: false, status: 404, error: 'Solicitação não encontrada' };
  const absenceData = existing[0] as any;

  const rows = await sql`
    UPDATE absences SET
      status      = ${newStatus},
      approved_by = ${ctx.sub},
      approved_at = now()
    WHERE id = ${absenceId} AND company_id = ${ctx.company_id}
    RETURNING *, (SELECT user_id FROM employees WHERE id = absences.employee_id) AS employee_user_id
  `;
  if (!rows[0]) return { ok: false, status: 404, error: 'Solicitação não encontrada' };

  if (absenceData.type === 'ferias') {
    if (approved) {
      await sql`
        UPDATE employees SET vacation_days = GREATEST(0, vacation_days - ${absenceData.days_count})
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    } else if (absenceData.status === 'aprovado') {
      await sql`
        UPDATE employees SET vacation_days = vacation_days + ${absenceData.days_count}
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    }
  }

  if (absenceData.type === 'folga' && absenceData.hours != null) {
    if (approved) {
      await sql`
        UPDATE employees SET folga_hours = GREATEST(0, folga_hours - ${absenceData.hours})
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    } else if (absenceData.status === 'aprovado') {
      await sql`
        UPDATE employees SET folga_hours = folga_hours + ${absenceData.hours}
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
      `.catch(() => {});
    }
  }

  const empUserId = (rows[0] as any).employee_user_id;
  const notifTitle = approved ? 'Férias aprovadas ✅' : 'Férias recusadas ❌';
  const notifBody  = approved ? 'Sua solicitação de férias foi aprovada.' : 'Sua solicitação de férias foi recusada.';

  await sql`
    INSERT INTO notifications (company_id, user_id, title, body, type, route)
    VALUES (${ctx.company_id}, ${empUserId ?? null}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
  `.catch(() => {});

  if (empUserId) {
    const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${empUserId}`;
    await sendPush(tokens.map((t: any) => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
  }

  return { ok: true, status: 200, absence: rows[0] };
}
