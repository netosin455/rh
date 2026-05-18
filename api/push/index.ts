// ============================================================
// api/push/index.ts — POST /api/push
// Salva token Expo de push notification para o usuário autenticado
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Método não permitido');

  let ctx;
  try { ctx = authenticate(req); } catch (e: any) { return err(res, e.status ?? 401, e.message); }

  const { token, platform } = req.body ?? {};
  if (typeof token !== 'string' || !token.startsWith('ExponentPushToken[')) {
    return err(res, 400, 'token Expo inválido');
  }
  if (platform && !['ios', 'android'].includes(platform)) {
    return err(res, 400, 'platform deve ser "ios" ou "android"');
  }

  try {
    await sql`
      INSERT INTO push_tokens (user_id, token, platform)
      VALUES (${ctx.sub}, ${token}, ${platform ?? null})
      ON CONFLICT (user_id, token) DO NOTHING
    `;
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    console.error(`[${new Date().toISOString()}] [ERROR] /api/push:`, e);
    return err(res, 500, 'Erro ao salvar token');
  }
}
