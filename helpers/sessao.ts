// ============================================================
// helpers/sessao.ts — SuperRH
// Restauração da sessão salva (token + usuário) sem React e sem AsyncStorage
// direto: o armazenamento é injetado, então dá para testar o caso "storage corrompido".
// Regra: NUNCA lança. Qualquer problema limpa a sessão e devolve null (cai no login).
// ============================================================

import type { User } from '../tipos/modelos';

export const TOKEN_KEY = '@superrh:token';
export const USER_KEY = '@superrh:user';

/** O mínimo que precisamos do AsyncStorage. */
export interface ArmazenamentoSessao {
  getItem(chave: string): Promise<string | null>;
  removeItem(chave: string): Promise<void>;
}

export interface SessaoSalva {
  token: string;
  user: User;
}

/** True se o JWT estiver ausente de exp, malformado ou vencido. Não valida assinatura (isso é da API). */
export function tokenExpirado(token: string, agoraMs: number = Date.now()): boolean {
  try {
    const parte = token.split('.')[1];
    if (!parte) return true;
    // JWT usa base64url; atob espera base64 comum.
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    const exp = (payload as { exp?: unknown } | null)?.exp;
    return typeof exp !== 'number' || exp * 1000 < agoraMs;
  } catch {
    return true;
  }
}

function pareceUsuario(valor: unknown): valor is User {
  if (typeof valor !== 'object' || valor === null) return false;
  const u = valor as Record<string, unknown>;
  return typeof u.id === 'number' && typeof u.role === 'string';
}

/** Apaga token e usuário; falha de storage aqui não pode travar nada. */
export async function limparSessao(storage: ArmazenamentoSessao): Promise<void> {
  const resultados = await Promise.allSettled([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)]);
  for (const r of resultados) {
    // Sem PII: só o motivo técnico.
    if (r.status === 'rejected') console.warn('[Sessão] não foi possível limpar o armazenamento:', r.reason);
  }
}

/**
 * Lê a sessão salva. Token ausente, vencido, usuário ausente ou JSON corrompido
 * => limpa o armazenamento e devolve null. Nunca lança.
 */
export async function restaurarSessao(storage: ArmazenamentoSessao, agoraMs: number = Date.now()): Promise<SessaoSalva | null> {
  try {
    const [token, usuarioBruto] = await Promise.all([storage.getItem(TOKEN_KEY), storage.getItem(USER_KEY)]);
    if (!token && !usuarioBruto) return null;

    if (!token || !usuarioBruto || tokenExpirado(token, agoraMs)) {
      await limparSessao(storage);
      return null;
    }
    const user: unknown = JSON.parse(usuarioBruto);
    if (!pareceUsuario(user)) {
      await limparSessao(storage);
      return null;
    }
    return { token, user };
  } catch (e: unknown) {
    console.warn('[Sessão] sessão salva ilegível, voltando ao login:', e instanceof Error ? e.name : 'erro');
    await limparSessao(storage);
    return null;
  }
}
