// ============================================================
// contexts/AuthContext.tsx — SuperRH
// ============================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fazerLogin } from '../conexoes/autenticacao';
import { setUnauthorizedHandler } from '../conexoes/http';
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

    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, data.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)),
    ]);

    setToken(data.token);
    setUser(data.user);
  }

  async function loginWithToken(rawToken: string) {
    if (tokenExpirado(rawToken)) throw new Error('Token expirado');
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
    await limparSessao(AsyncStorage);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
