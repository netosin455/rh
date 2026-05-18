// ============================================================
// api/users/index.ts — /api/users  e  /api/users/:id
// Apenas super_admin
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import bcrypt from 'bcryptjs';
import { sql, cors, authenticate, err, VALID_ROLES, parsePagination } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  if (ctx.role !== 'super_admin') return err(res, 403, 'Acesso restrito ao administrador do sistema');

  // ── Rotas com :id ─────────────────────────────────────────
  if (req.query.id) {
    const id = Number(req.query.id);
    if (!id) return err(res, 400, 'ID inválido');

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, company_id, name, email, role, created_at
        FROM users WHERE id = ${id} AND company_id = ${ctx.company_id}
      `;
      if (!rows[0]) return err(res, 404, 'Usuário não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'PUT') {
      if (id === ctx.sub) return err(res, 400, 'Você não pode editar sua própria conta por aqui');
      const { name, email, password, role } = req.body ?? {};

      if (role && !(VALID_ROLES as readonly string[]).includes(role)) {
        return err(res, 400, `Cargo inválido. Use: ${VALID_ROLES.join(', ')}`);
      }
      if (password && String(password).length < 6) {
        return err(res, 400, 'Senha deve ter no mínimo 6 caracteres');
      }

      const trimmedName  = name  ? String(name).trim()                : null;
      const trimmedEmail = email ? String(email).toLowerCase().trim() : null;
      if (trimmedName  === '') return err(res, 400, 'Nome não pode ser vazio');
      if (trimmedEmail === '') return err(res, 400, 'Email não pode ser vazio');

      const newHash = password ? await bcrypt.hash(String(password), 10) : null;

      const rows = await sql`
        UPDATE users SET
          name          = COALESCE(${trimmedName},  name),
          email         = COALESCE(${trimmedEmail}, email),
          password_hash = COALESCE(${newHash},      password_hash),
          role          = COALESCE(${role ?? null},  role)
        WHERE id = ${id} AND company_id = ${ctx.company_id}
        RETURNING id, company_id, name, email, role, created_at
      `;
      if (!rows[0]) return err(res, 404, 'Usuário não encontrado');
      return res.json(rows[0]);
    }

    if (req.method === 'DELETE') {
      if (id === ctx.sub) return err(res, 400, 'Você não pode excluir sua própria conta');
      await sql`DELETE FROM users WHERE id = ${id} AND company_id = ${ctx.company_id}`;
      return res.status(204).end();
    }

    return err(res, 405, 'Método não permitido');
  }

  // ── Rotas de coleção (/api/users) ─────────────────────────

  if (req.method === 'GET') {
    const { page, limit, offset } = parsePagination(req.query);

    const [countRow, rows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM users WHERE company_id = ${ctx.company_id}`,
      sql`
        SELECT id, company_id, name, email, role, created_at
        FROM users
        WHERE company_id = ${ctx.company_id}
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `,
    ]);

    const total = countRow[0]?.total ?? 0;
    return res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

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

    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing[0]) return err(res, 409, 'Email já está em uso');

    const hash = await bcrypt.hash(String(password), 10);

    const rows = await sql`
      INSERT INTO users (company_id, name, email, password_hash, role)
      VALUES (${ctx.company_id}, ${String(name).trim()}, ${normalizedEmail}, ${hash}, ${role})
      RETURNING id, company_id, name, email, role, created_at
    `;
    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
