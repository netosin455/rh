// ============================================================
// api/auth/login.ts — POST /api/auth/login
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, cors, err, JWT_SECRET } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Método não permitido');

  const { email, password } = req.body ?? {};
  if (!email || !password) return err(res, 400, 'Email e senha obrigatórios');

  const rows = await sql`
    SELECT id, company_id, name, email, password_hash, role
    FROM users
    WHERE email = ${String(email).trim().toLowerCase()}
    LIMIT 1
  `;

  const user = rows[0];
  if (!user) return err(res, 401, 'Credenciais inválidas');

  const valid = await bcrypt.compare(String(password), user.password_hash as string);
  if (!valid) return err(res, 401, 'Credenciais inválidas');

  const token = jwt.sign(
    {
      sub:        user.id,
      company_id: user.company_id,
      role:       user.role,
      name:       user.name,
      email:      user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  return res.json({
    token,
    user: {
      id:         user.id,
      company_id: user.company_id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
    },
  });
}
