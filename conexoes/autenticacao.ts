// ============================================================
// conexoes/autenticacao.ts — SuperRH
// Login pela API. Usa publicFetch (sem token): ganha o timeout de 15 s e as mesmas
// mensagens de rede do resto do app. Uma senha errada (401) NÃO dispara o handler de
// sessão expirada, porque ainda não existe sessão.
// ============================================================

import { ApiError, publicFetch } from './http';
import type { User } from '../tipos/modelos';

export interface RespostaLogin {
  token: string;
  user: User;
}

/** Faz o login. Erros: mensagem do servidor, ou texto claro de timeout/sem conexão. */
export async function fazerLogin(username: string, password: string): Promise<RespostaLogin> {
  try {
    return await publicFetch<RespostaLogin>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
  } catch (e: unknown) {
    // O texto padrão de timeout de escrita ("a ação pode ter sido concluída") não serve para login.
    if (e instanceof ApiError && e.status === 0 && e.message.includes('demorou demais')) {
      throw new ApiError(0, 'O servidor demorou demais para responder. Tente novamente.');
    }
    // Servidor respondeu, mas sem mensagem própria ("Erro 500"): mantém o texto de antes.
    if (e instanceof ApiError && e.status > 0 && /^Erro \d+$/.test(e.message)) {
      throw new ApiError(e.status, 'Erro ao fazer login');
    }
    throw e;
  }
}
