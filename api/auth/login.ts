// ============================================================
// api/auth/login.ts
// POST /api/auth/login      — credenciais normais
// GET  /api/auth/google     — inicia OAuth Google (redirect)
// GET  /api/auth/google?code — callback OAuth Google
// Rate limiting: máx 5 tentativas falhas em 15 minutos por email
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, cors, err, JWT_SECRET } from '../_lib';

const MAX_ATTEMPTS  = 5;
const WINDOW_MINUTES = 15;

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const APP_URL              = process.env.EXPO_PUBLIC_API_URL   ?? 'https://super-rh.vercel.app';
const GOOGLE_REDIRECT_URI  = `${APP_URL}/api/auth/google`;
const GOOGLE_SCOPES        = 'openid email profile';

// ── Google OAuth helpers ─────────────────────────────────────

function googleAuthURL(): string {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope:         GOOGLE_SCOPES,
    access_type:   'offline',
    prompt:        'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeGoogleCode(code: string): Promise<{ email: string; name: string; picture?: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code',
    }).toString(),
  });
  if (!tokenRes.ok) throw new Error('Falha ao trocar código Google');
  const tokens = await tokenRes.json() as any;

  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) throw new Error('Falha ao obter perfil Google');
  return infoRes.json() as any;
}

// ── Handler principal ────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET /api/auth/google — inicia ou recebe callback OAuth
    if (req.query.google === 'true') {
      if (!GOOGLE_CLIENT_ID) {
        return err(res, 503, 'SSO Google não configurado neste ambiente');
      }

      // Callback: Google mandou o code de volta
      if (req.query.code) {
        const code    = String(req.query.code);
        const profile = await exchangeGoogleCode(code);

        // Busca usuário por email
        const rows = await sql`
          SELECT id, company_id, name, email, role
          FROM users WHERE email = ${profile.email} LIMIT 1
        `;

        let user = rows[0];

        // Auto-provisioning: cria conta readonly se email desconhecido
        if (!user) {
          const inserted = await sql`
            INSERT INTO users (company_id, name, email, username, password_hash, role)
            SELECT company_id, ${profile.name}, ${profile.email},
                   ${profile.email}, '', 'colaborador'
            FROM users WHERE company_id IS NOT NULL LIMIT 1
            RETURNING id, company_id, name, email, role
          `;
          user = inserted[0];
          if (!user) {
            const html = `<html><body><script>
              window.location.href = '/?sso_error=${encodeURIComponent('Email não autorizado')}';
            </script></body></html>`;
            return res.status(401).send(html);
          }
        }

        const token = jwt.sign(
          { sub: user.id, company_id: user.company_id, role: user.role, name: user.name, email: user.email },
          JWT_SECRET,
          { expiresIn: '7d' },
        );

        // Redireciona de volta ao app com o token no hash
        const html = `<html><body><script>
          window.location.href = '/?sso_token=${encodeURIComponent(token)}';
        </script></body></html>`;
        return res.status(200).send(html);
      }

      // Nenhum code: inicia o fluxo — redireciona para Google
      return res.redirect(302, googleAuthURL());
    }

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
