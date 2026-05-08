// ============================================================
// api/auth/login.ts — POST /api/auth/login
// Rate limiting: máx 5 tentativas falhas em 15 minutos por email
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, cors, err, JWT_SECRET } from '../_lib';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return err(res, 405, 'Método não permitido');

    const { username, password } = req.body ?? {};
    if (!username || !password) return err(res, 400, 'Usuário e senha obrigatórios');

    const normalizedUsername = String(username).trim().toLowerCase();

    // Verifica tentativas falhas — ignora erro caso tabela não exista ainda
    try {
      const attempts = await sql`
        SELECT COUNT(*)::int AS count
        FROM login_attempts
        WHERE email = ${normalizedUsername}
          AND failed = true
          AND attempted_at >= NOW() - (${WINDOW_MINUTES} * INTERVAL '1 minute')
      `;
      if ((attempts[0]?.count ?? 0) >= MAX_ATTEMPTS) {
        return err(res, 429, `Muitas tentativas. Tente novamente em ${WINDOW_MINUTES} minutos.`);
      }
    } catch { /* tabela login_attempts não existe ainda — ignora */ }

    const rows = await sql`
      SELECT id, company_id, name, email, password_hash, role
      FROM users
      WHERE username = ${normalizedUsername}
      LIMIT 1
    `;

    const user = rows[0];

    // Credenciais inválidas: registra tentativa falha
    if (!user || !(await bcrypt.compare(String(password), user.password_hash as string))) {
      try {
        await sql`
          INSERT INTO login_attempts (email, failed, attempted_at)
          VALUES (${normalizedUsername}, true, NOW())
        `;
      } catch { /* ignora se tabela não existir */ }
      return err(res, 401, 'Credenciais inválidas');
    }

    // Login OK: limpa tentativas falhas
    try {
      await sql`DELETE FROM login_attempts WHERE email = ${normalizedUsername}`;
    } catch { /* ignora se tabela não existir */ }

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
  } catch (e: any) {
    return err(res, 500, e?.message ?? 'Erro interno no servidor');
  }
}
