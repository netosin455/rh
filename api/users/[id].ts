// ============================================================
// api/users/[id].ts — GET PUT DELETE /api/users/:id
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

  const id = Number(req.query.id);
  if (!id) return err(res, 400, 'ID inválido');

  // ── GET ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, company_id, name, email, username, role, created_at
      FROM users WHERE id = ${id} AND company_id = ${ctx.company_id}
    `;
    if (!rows[0]) return err(res, 404, 'Usuário não encontrado');
    return res.json(rows[0]);
  }

  // ── PUT ───────────────────────────────────────────────────
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
      RETURNING id, company_id, name, email, username, role, created_at
    `;
    if (!rows[0]) return err(res, 404, 'Usuário não encontrado');
    return res.json(rows[0]);
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (id === ctx.sub) return err(res, 400, 'Você não pode excluir sua própria conta');

    await sql`DELETE FROM users WHERE id = ${id} AND company_id = ${ctx.company_id}`;
    return res.status(204).end();
  }

  return err(res, 405, 'Método não permitido');
}
