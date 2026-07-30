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
