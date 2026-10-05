// ============================================================
// api/_lib.ts — SuperRH
// Utilitários compartilhados: DB, JWT, CORS
// ============================================================

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { calendarDaysInclusive, isValidIsoDate } from '../helpers/datas';

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

const DEFAULT_ALLOWED_ORIGINS = [
  'https://super-rh.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
}

/**
 * Adiciona headers CORS restritos a uma allowlist (produção + dev local),
 * em vez de refletir '*' pra qualquer origem (achado do scan de segurança).
 */
export function cors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers['origin'] as string | undefined;
  const allowed = getAllowedOrigins();
  res.setHeader('Access-Control-Allow-Origin', origin && allowed.includes(origin) ? origin : allowed[0]);
  res.setHeader('Vary', 'Origin');
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
  const employeeId = Number(employee_id);

  if (!Number.isInteger(employeeId) || employeeId <= 0 || !start_date || !end_date) {
    return { ok: false, status: 400, error: 'employee_id, start_date e end_date são obrigatórios' };
  }
  if (!ABSENCE_VALID_TYPES.includes(type)) {
    return { ok: false, status: 400, error: `Tipo inválido. Use: ${ABSENCE_VALID_TYPES.join(', ')}` };
  }
  if (!isValidIsoDate(start_date) || !isValidIsoDate(end_date)) {
    return { ok: false, status: 400, error: 'start_date e end_date devem ter datas válidas no formato YYYY-MM-DD' };
  }
  if (start_date > end_date) {
    return { ok: false, status: 400, error: 'end_date deve ser igual ou posterior a start_date' };
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
    WHERE id = ${employeeId} AND company_id = ${ctx.company_id} AND deleted_at IS NULL
  `;
  if (!empCheck[0]) return { ok: false, status: 404, error: 'Funcionário não encontrado' };
  const emp = empCheck[0] as any;

  const canCreateForOthers = CAN_MANAGE_EMPLOYEES.includes(ctx.role) || CAN_APPROVE_ABSENCES.includes(ctx.role);
  if (!canCreateForOthers && emp.user_id !== ctx.sub) {
    return { ok: false, status: 403, error: 'Você só pode solicitar ausências para o seu próprio cadastro' };
  }

  const daysRequested = calendarDaysInclusive(start_date, end_date);

  if (type === 'ferias' && daysRequested > emp.vacation_days) {
    return { ok: false, status: 422, error: `Saldo insuficiente. ${emp.name} tem ${emp.vacation_days} dia(s) disponível(is), mas foram solicitados ${daysRequested}.` };
  }
  if (type === 'folga' && hoursRequested != null && hoursRequested > Number(emp.folga_hours)) {
    return { ok: false, status: 422, error: `Saldo insuficiente. ${emp.name} tem ${emp.folga_hours}h de folga disponível(is), mas foram solicitadas ${hoursRequested}h.` };
  }

  const overlap = await sql`
    SELECT id FROM absences
    WHERE employee_id = ${employeeId} AND company_id = ${ctx.company_id}
      AND status NOT IN ('recusado', 'cancelado')
      AND start_date <= ${end_date}
      AND end_date   >= ${start_date}
  `;
  if (overlap[0]) {
    return { ok: false, status: 409, error: 'O colaborador já possui uma ausência registrada neste período.' };
  }

  const autoApprove = CAN_APPROVE_ABSENCES.includes(ctx.role);

  let rows: any[];
  if (autoApprove && type === 'ferias') {
    // O débito e o lançamento precisam ser indivisíveis: o predicado de saldo
    // protege também duas solicitações concorrentes para o mesmo colaborador.
    rows = await sql`
      WITH debited AS (
        UPDATE employees SET vacation_days = vacation_days - ${daysRequested}
        WHERE id = ${employeeId} AND company_id = ${ctx.company_id}
          AND vacation_days >= ${daysRequested}
        RETURNING id
      )
      INSERT INTO absences
        (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours, status, approved_by, approved_at)
      SELECT
        ${ctx.company_id}, ${employeeId}, ${type}, ${start_date}, ${end_date},
        ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested}, 'aprovado', ${ctx.sub}, now()
      FROM debited
      RETURNING *
    `;
    if (!rows[0]) return { ok: false, status: 422, error: 'Saldo de férias insuficiente para registrar esta ausência' };
  } else if (autoApprove && type === 'folga' && hoursRequested != null) {
    rows = await sql`
      WITH debited AS (
        UPDATE employees SET folga_hours = folga_hours - ${hoursRequested}
        WHERE id = ${employeeId} AND company_id = ${ctx.company_id}
          AND folga_hours >= ${hoursRequested}
        RETURNING id
      )
      INSERT INTO absences
        (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours, status, approved_by, approved_at)
      SELECT
        ${ctx.company_id}, ${employeeId}, ${type}, ${start_date}, ${end_date},
        ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested}, 'aprovado', ${ctx.sub}, now()
      FROM debited
      RETURNING *
    `;
    if (!rows[0]) return { ok: false, status: 422, error: 'Saldo de banco de horas insuficiente para registrar esta ausência' };
  } else if (autoApprove) {
    rows = await sql`
        INSERT INTO absences
          (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours, status, approved_by, approved_at)
        VALUES
          (${ctx.company_id}, ${employeeId}, ${type}, ${start_date}, ${end_date},
           ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested}, 'aprovado', ${ctx.sub}, now())
        RETURNING *
      `;
  } else {
    rows = await sql`
        INSERT INTO absences
          (company_id, employee_id, type, start_date, end_date, reason, attachment_url, hours)
        VALUES
          (${ctx.company_id}, ${employeeId}, ${type}, ${start_date}, ${end_date},
           ${reason ?? null}, ${attachment_url ?? null}, ${hoursRequested})
        RETURNING *
      `;
  }

  const typeLabel = absenceTypeLabel(type);
  const qtyLabel = hoursRequested != null ? `${hoursRequested}h` : `${daysRequested} dia${daysRequested > 1 ? 's' : ''}`;

  if (autoApprove) {
    if (typeof emp.user_id === 'number') {
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
      const rhUserId = (u as { id?: unknown }).id;
      if (typeof rhUserId !== 'number') continue;

      await sql`
        INSERT INTO notifications (company_id, user_id, title, body, type, route)
        VALUES (${ctx.company_id}, ${rhUserId}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
      `.catch(() => {});
      const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${rhUserId}`.catch(() => []);
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
    SELECT a.type, a.days_count, a.hours, a.status, a.employee_id,
      e.vacation_days, e.folga_hours
    FROM absences a
    JOIN employees e ON e.id = a.employee_id AND e.company_id = a.company_id
    WHERE a.id = ${absenceId} AND a.company_id = ${ctx.company_id}
  `;
  if (!existing[0]) return { ok: false, status: 404, error: 'Solicitação não encontrada' };
  const absenceData = existing[0] as any;
  if (absenceData.status !== 'pendente') {
    return { ok: false, status: 409, error: 'Esta solicitação já foi processada' };
  }
  if (approved && absenceData.type === 'ferias' && absenceData.days_count > Number(absenceData.vacation_days)) {
    return { ok: false, status: 422, error: 'Saldo de férias insuficiente para aprovar esta solicitação' };
  }
  if (approved && absenceData.type === 'folga' && absenceData.hours != null && Number(absenceData.hours) > Number(absenceData.folga_hours)) {
    return { ok: false, status: 422, error: 'Saldo de banco de horas insuficiente para aprovar esta solicitação' };
  }

  let rows: any[];
  if (approved && absenceData.type === 'ferias') {
    rows = await sql`
      WITH debited AS (
        UPDATE employees SET vacation_days = vacation_days - ${absenceData.days_count}
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
          AND vacation_days >= ${absenceData.days_count}
        RETURNING id
      ), updated AS (
        UPDATE absences SET status = ${newStatus}, approved_by = ${ctx.sub}, approved_at = now()
        WHERE id = ${absenceId} AND company_id = ${ctx.company_id} AND status = 'pendente'
          AND EXISTS (SELECT 1 FROM debited)
        RETURNING *
      )
      SELECT updated.*,
        (SELECT user_id FROM employees WHERE id = updated.employee_id AND company_id = ${ctx.company_id}) AS employee_user_id
      FROM updated
    `;
  } else if (approved && absenceData.type === 'folga' && absenceData.hours != null) {
    rows = await sql`
      WITH debited AS (
        UPDATE employees SET folga_hours = folga_hours - ${absenceData.hours}
        WHERE id = ${absenceData.employee_id} AND company_id = ${ctx.company_id}
          AND folga_hours >= ${absenceData.hours}
        RETURNING id
      ), updated AS (
        UPDATE absences SET status = ${newStatus}, approved_by = ${ctx.sub}, approved_at = now()
        WHERE id = ${absenceId} AND company_id = ${ctx.company_id} AND status = 'pendente'
          AND EXISTS (SELECT 1 FROM debited)
        RETURNING *
      )
      SELECT updated.*,
        (SELECT user_id FROM employees WHERE id = updated.employee_id AND company_id = ${ctx.company_id}) AS employee_user_id
      FROM updated
    `;
  } else {
    rows = await sql`
      UPDATE absences SET
        status      = ${newStatus},
        approved_by = ${ctx.sub},
        approved_at = now()
      WHERE id = ${absenceId} AND company_id = ${ctx.company_id} AND status = 'pendente'
      RETURNING *,
        (SELECT user_id FROM employees WHERE id = absences.employee_id AND company_id = ${ctx.company_id}) AS employee_user_id
    `;
  }
  if (!rows[0]) return { ok: false, status: 404, error: 'Solicitação não encontrada' };

  const empUserId = (rows[0] as { employee_user_id?: unknown }).employee_user_id;
  const typeLabel = absenceTypeLabel(absenceData.type);
  const notifTitle = approved ? `${typeLabel} aprovada ✅` : `${typeLabel} recusada ❌`;
  const notifBody  = approved ? `Sua solicitação de ${typeLabel.toLowerCase()} foi aprovada.` : `Sua solicitação de ${typeLabel.toLowerCase()} foi recusada.`;

  // user_id nulo é interpretado como aviso global pela central de notificações.
  if (typeof empUserId === 'number') {
    await sql`
      INSERT INTO notifications (company_id, user_id, title, body, type, route)
      VALUES (${ctx.company_id}, ${empUserId}, ${notifTitle}, ${notifBody}, 'ferias', '/(tabs)/ferias')
    `.catch(() => {});

    const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${empUserId}`;
    await sendPush(tokens.map((t: any) => t.token), notifTitle, notifBody, { route: '/(tabs)/ferias' });
  }

  return { ok: true, status: 200, absence: rows[0] };
}

export type ApprovedAbsenceRecord = {
  id: number;
  employee_id: number;
  type: string;
  days_count: number;
  hours: number | null;
};

export type ApprovedAbsenceUpdate = {
  start_date: string;
  end_date: string;
  reason: string | null;
  hours: number | null;
};

type ApprovedAbsenceUpdateFailure = {
  ok: false;
  status: 409 | 422;
  error: string;
};

const APPROVED_ABSENCE_CHANGED_ERROR = 'Nao foi possivel editar: o lancamento mudou ou nao existe mais. Recarregue.';

function isPostgresErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === code;
}

async function approvedAbsenceUpdateFailure(
  ctx: JWTPayload,
  absence: ApprovedAbsenceRecord,
  nextDays: number,
  nextHours: number,
): Promise<ApprovedAbsenceUpdateFailure> {
  if (absence.type === 'folga') {
    const rows = await sql`
      SELECT e.folga_hours + COALESCE(a.hours, 0) >= ${nextHours} AS saldo_suficiente
      FROM absences a
      JOIN employees e ON e.id = a.employee_id AND e.company_id = ${ctx.company_id}
      WHERE a.id = ${absence.id} AND a.company_id = ${ctx.company_id}
        AND a.status = 'aprovado' AND a.type = 'folga'
    `;
    const current = rows[0] as { saldo_suficiente?: unknown } | undefined;
    if (!current) return { ok: false, status: 409, error: APPROVED_ABSENCE_CHANGED_ERROR };
    const sufficient = current.saldo_suficiente === true;
    return sufficient
      ? { ok: false, status: 409, error: APPROVED_ABSENCE_CHANGED_ERROR }
      : { ok: false, status: 422, error: 'Saldo de banco de horas insuficiente para aumentar as horas da folga.' };
  }

  if (absence.type === 'ferias') {
    const rows = await sql`
      SELECT e.vacation_days + a.days_count >= ${nextDays} AS saldo_suficiente
      FROM absences a
      JOIN employees e ON e.id = a.employee_id AND e.company_id = ${ctx.company_id}
      WHERE a.id = ${absence.id} AND a.company_id = ${ctx.company_id}
        AND a.status = 'aprovado' AND a.type = 'ferias'
    `;
    const current = rows[0] as { saldo_suficiente?: unknown } | undefined;
    if (!current) return { ok: false, status: 409, error: APPROVED_ABSENCE_CHANGED_ERROR };
    const sufficient = current.saldo_suficiente === true;
    return sufficient
      ? { ok: false, status: 409, error: APPROVED_ABSENCE_CHANGED_ERROR }
      : { ok: false, status: 422, error: 'Saldo de férias insuficiente para aumentar os dias da ausência.' };
  }

  return { ok: false, status: 409, error: APPROVED_ABSENCE_CHANGED_ERROR };
}

/**
 * Edita uma ausência já aprovada e ajusta o saldo no mesmo comando SQL.
 * A ausência é alterada antes do saldo; a verificação final desfaz ambas em caso de corrida.
 */
export async function updateApprovedAbsenceRecord(
  ctx: JWTPayload,
  absence: ApprovedAbsenceRecord,
  update: ApprovedAbsenceUpdate,
): Promise<{ ok: true; absence: unknown } | ApprovedAbsenceUpdateFailure> {
  const nextDays = calendarDaysInclusive(update.start_date, update.end_date);
  const nextHours = Number(update.hours ?? 0);
  let rows: unknown[];

  try {
    if (absence.type === 'folga') {
      rows = await sql`
        WITH antiga AS (
          SELECT a.id, a.employee_id, a.hours, e.folga_hours
          FROM absences a
          JOIN employees e ON e.id = a.employee_id AND e.company_id = ${ctx.company_id}
          WHERE a.id = ${absence.id} AND a.company_id = ${ctx.company_id}
            AND a.status = 'aprovado' AND a.type = 'folga'
          FOR UPDATE OF a, e
        ), ausencia_atualizada AS (
          UPDATE absences a
          SET start_date = ${update.start_date}, end_date = ${update.end_date},
            reason = ${update.reason}, hours = ${update.hours}
          FROM antiga
          WHERE a.id = antiga.id AND a.company_id = ${ctx.company_id}
            AND a.status = 'aprovado' AND a.type = 'folga'
            AND antiga.folga_hours + COALESCE(antiga.hours, 0) - ${nextHours} >= 0
          RETURNING a.*
        ), saldo_ajustado AS (
          UPDATE employees e
          SET folga_hours = e.folga_hours + COALESCE(antiga.hours, 0) - ${nextHours}
          FROM ausencia_atualizada atualizada
          JOIN antiga ON antiga.id = atualizada.id
          WHERE e.id = antiga.employee_id AND e.company_id = ${ctx.company_id}
          RETURNING e.id
        ), verificacao AS (
          SELECT 1 / (CASE WHEN
            (SELECT COUNT(*) FROM ausencia_atualizada) = 1
            AND (SELECT COUNT(*) FROM saldo_ajustado) = 1
          THEN 1 ELSE 0 END) AS confirmado
        )
        SELECT atualizada.*
        FROM verificacao
        JOIN ausencia_atualizada atualizada ON TRUE
      `;
    } else if (absence.type === 'ferias') {
      rows = await sql`
        WITH antiga AS (
          SELECT a.id, a.employee_id, a.days_count, e.vacation_days
          FROM absences a
          JOIN employees e ON e.id = a.employee_id AND e.company_id = ${ctx.company_id}
          WHERE a.id = ${absence.id} AND a.company_id = ${ctx.company_id}
            AND a.status = 'aprovado' AND a.type = 'ferias'
          FOR UPDATE OF a, e
        ), ausencia_atualizada AS (
          UPDATE absences a
          SET start_date = ${update.start_date}, end_date = ${update.end_date},
            reason = ${update.reason}, hours = ${update.hours}
          FROM antiga
          WHERE a.id = antiga.id AND a.company_id = ${ctx.company_id}
            AND a.status = 'aprovado' AND a.type = 'ferias'
            AND antiga.vacation_days + antiga.days_count - ${nextDays} >= 0
          RETURNING a.*
        ), saldo_ajustado AS (
          UPDATE employees e
          SET vacation_days = e.vacation_days + antiga.days_count - ${nextDays}
          FROM ausencia_atualizada atualizada
          JOIN antiga ON antiga.id = atualizada.id
          WHERE e.id = antiga.employee_id AND e.company_id = ${ctx.company_id}
          RETURNING e.id
        ), verificacao AS (
          SELECT 1 / (CASE WHEN
            (SELECT COUNT(*) FROM ausencia_atualizada) = 1
            AND (SELECT COUNT(*) FROM saldo_ajustado) = 1
          THEN 1 ELSE 0 END) AS confirmado
        )
        SELECT atualizada.*
        FROM verificacao
        JOIN ausencia_atualizada atualizada ON TRUE
      `;
    } else {
      rows = await sql`
        UPDATE absences SET start_date = ${update.start_date}, end_date = ${update.end_date},
          reason = ${update.reason}, hours = ${update.hours}
        WHERE id = ${absence.id} AND company_id = ${ctx.company_id} AND status = 'aprovado'
        RETURNING *
      `;
    }
  } catch (error) {
    if (!isPostgresErrorWithCode(error, '22012')) throw error;
    return approvedAbsenceUpdateFailure(ctx, absence, nextDays, nextHours);
  }

  if (!rows[0]) return approvedAbsenceUpdateFailure(ctx, absence, nextDays, nextHours);
  return { ok: true, absence: rows[0] };
}

/** Restaura o saldo debitado por uma ausência aprovada antes de removê-la. */
export async function deleteApprovedAbsenceRecord(
  ctx: JWTPayload,
  absence: ApprovedAbsenceRecord,
): Promise<boolean> {
  let rows: unknown[];
  if (absence.type === 'folga' && absence.hours != null) {
    rows = await sql`
      WITH excluida AS (
        DELETE FROM absences
        WHERE id = ${absence.id} AND company_id = ${ctx.company_id}
          AND status = 'aprovado' AND type = 'folga'
        RETURNING employee_id, hours
      )
      UPDATE employees e SET folga_hours = e.folga_hours + excluida.hours
      FROM excluida
      WHERE e.id = excluida.employee_id AND e.company_id = ${ctx.company_id}
      RETURNING e.id
    `;
  } else if (absence.type === 'ferias') {
    rows = await sql`
      WITH excluida AS (
        DELETE FROM absences
        WHERE id = ${absence.id} AND company_id = ${ctx.company_id}
          AND status = 'aprovado' AND type = 'ferias'
        RETURNING employee_id, days_count
      )
      UPDATE employees e SET vacation_days = e.vacation_days + excluida.days_count
      FROM excluida
      WHERE e.id = excluida.employee_id AND e.company_id = ${ctx.company_id}
      RETURNING e.id
    `;
  } else {
    rows = await sql`
      DELETE FROM absences
      WHERE id = ${absence.id} AND company_id = ${ctx.company_id} AND status = 'aprovado'
      RETURNING id
    `;
  }
  return Boolean(rows[0]);
}
