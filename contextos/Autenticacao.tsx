// ============================================================
// contexts/AuthContext.tsx — SuperRH
// ============================================================

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fazerLogin } from '../conexoes/autenticacao';
import { setUnauthorizedHandler } from '../conexoes/http';
import { limpar as limparCache } from '../helpers/cacheDados';
import { limparSessao, restaurarSessao, TOKEN_KEY, tokenExpirado, USER_KEY } from '../helpers/sessao';
import { User, AuthState } from '../tipos/modelos';

interface AuthContextData extends AuthState {
  login:           (username: string, password: string) => Promise<void>;
  loginWithToken:  (token: string) => Promise<void>;
  logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega a sessão salva. restaurarSessao nunca lança (storage vazio, token vencido ou JSON
  // corrompido limpam tudo e caem no login); o finally garante que o loading SEMPRE termina.
  useEffect(() => {
    let ativo = true;
    async function loadAuth() {
      try {
        const sessao = await restaurarSessao(AsyncStorage);
        if (ativo && sessao) {
          setToken(sessao.token);
          setUser(sessao.user);
        }
      } catch (e: unknown) {
        console.warn('[Sessão] falha inesperada ao restaurar:', e instanceof Error ? e.name : 'erro');
      } finally {
        if (ativo) setLoading(false);
      }
    }
    void loadAuth();
    return () => { ativo = false; };
  }, []);

  // Troca de usuário ou de empresa (por qualquer caminho): o cache da sessão anterior não vale.
  // Só quando já havia alguém e agora é OUTRA pessoa/empresa (ou ninguém). Entrar (null → usuário) não limpa aqui:
  // login() já limpou antes, e limpar de novo derrubaria as buscas que as telas acabaram de iniciar.
  const usuarioAnterior = useRef<{ id: number; empresa: number } | null>(null);
  useEffect(() => {
    const anterior = usuarioAnterior.current;
    if (anterior && (anterior.id !== user?.id || anterior.empresa !== user?.company_id)) limparCache();
    usuarioAnterior.current = user ? { id: user.id, empresa: user.company_id } : null;
  }, [user?.id, user?.company_id]);

  // 401 em qualquer tela: a camada HTTP já limpou o storage; aqui a sessão some da UI na hora
  // (o AuthGuard então manda para o login).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(username: string, password: string) {
    const data = await fazerLogin(username, password);
    // Dado em cache é da sessão anterior: some antes de a nova entrar (computador compartilhado).
    limparCache();

    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, data.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)),
    ]);

    setToken(data.token);
    setUser(data.user);
  }

  async function loginWithToken(rawToken: string) {
    if (tokenExpirado(rawToken)) throw new Error('Token expirado');
    limparCache();
    const payload = JSON.parse(atob(rawToken.split('.')[1]));
    const userData: User = {
      id:         payload.sub,
      company_id: payload.company_id,
      name:       payload.name,
      email:      payload.email,
      role:       payload.role,
    };
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, rawToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
    ]);
    setToken(rawToken);
    setUser(userData);
  }

  async function logout() {
    // Primeiro o usuário sai (as telas deixam de buscar), depois o cache é esquecido e o armazenamento limpo.
    setToken(null);
    setUser(null);
    limparCache();
    await limparSessao(AsyncStorage);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
