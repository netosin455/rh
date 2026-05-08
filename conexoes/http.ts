// ============================================================
// services/api.ts — SuperRH
// Cliente HTTP centralizado com autenticação automática
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  console.warn('[SuperRH] EXPO_PUBLIC_API_URL não definida. Chamadas à API vão falhar.');
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'URL da API não configurada.');

  const token = await AsyncStorage.getItem('@superrh:token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) {
      throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.');
    }
    throw new ApiError(0, 'Erro de conexão. Tente novamente.');
  }

  if (res.status === 401) {
    await AsyncStorage.removeItem('@superrh:token');
    await AsyncStorage.removeItem('@superrh:user');
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error || `Erro ${res.status}`);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}
