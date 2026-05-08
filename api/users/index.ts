// ============================================================
// api/users/index.ts — GET /api/users  POST /api/users
// Apenas super_admin
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import bcrypt from 'bcryptjs';
import { sql, cors, authenticate, err, VALID_ROLES } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  if (ctx.role !== 'super_admin') return err(res, 403, 'Acesso restrito ao administrador do sistema');

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, company_id, name, email, role, created_at
      FROM users
      WHERE company_id = ${ctx.company_id}
      ORDER BY name
    `;
    return res.json(rows);
  }

  // ── POST ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, email, password, role = 'rh' } = req.body ?? {};

    if (!name || !email || !password) {
      return err(res, 400, 'name, email e password são obrigatórios');
    }

    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      return err(res, 400, `Cargo inválido. Use: ${VALID_ROLES.join(', ')}`);
    }

    if (String(password).length < 6) {
      return err(res, 400, 'Senha deve ter no mínimo 6 caracteres');
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${String(email).toLowerCase().trim()}`;
    if (existing[0]) return err(res, 409, 'Este email já está em uso');

    const hash = await bcrypt.hash(String(password), 10);

    const rows = await sql`
      INSERT INTO users (company_id, name, email, password_hash, role)
      VALUES (${ctx.company_id}, ${String(name).trim()}, ${String(email).toLowerCase().trim()}, ${hash}, ${role})
      RETURNING id, company_id, name, email, role, created_at
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
