// ============================================================
// services/api.ts — SuperRH
// Cliente HTTP centralizado com autenticação automática
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** Tempo máximo de espera por uma resposta da API. */
export const TIMEOUT_MS = 15_000;

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

/** Formato das listas da API: array puro (legado) ou envelope paginado. */
export type RespostaLista<T> = T[] | { data: T[]; total?: number };

/** Extrai o array de uma resposta de lista, aceitando os dois formatos. */
export function extrairLista<T>(res: RespostaLista<T>): T[] {
  return Array.isArray(res) ? res : res.data;
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

/**
 * Chamada autenticada à API com timeout de 15 s (AbortController).
 * Nunca refaz a requisição sozinha: repetir uma escrita poderia duplicar o registro.
 */
export async function apiFetch<T = unknown>(
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

  const metodo = (options.method ?? 'GET').toUpperCase();
  const isLeitura = metodo === 'GET' || metodo === 'HEAD';

  const controller = new AbortController();
  let expirou = false;
  const timer = setTimeout(() => {
    expirou = true;
    controller.abort();
  }, TIMEOUT_MS);

  // Respeita um signal externo (ex.: tela que desmontou) sem perder o timeout.
  const signalExterno = options.signal;
  if (signalExterno) {
    if (signalExterno.aborted) controller.abort();
    else signalExterno.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    } catch (e: unknown) {
      throw traduzirFalhaDeRede(e, expirou, isLeitura);
    }

    if (res.status === 401) {
      await AsyncStorage.removeItem('@superrh:token');
      await AsyncStorage.removeItem('@superrh:user');
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }

    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body?.error || `Erro ${res.status}`);
    }

    if (res.status === 204) return undefined as T;

    try {
      return (await res.json()) as T;
    } catch (e: unknown) {
      // O timer continua valendo durante a leitura do corpo.
      if (isAbortError(e)) throw traduzirFalhaDeRede(e, expirou, isLeitura);
      throw e;
    }
  } finally {
    clearTimeout(timer);
  }
}

function traduzirFalhaDeRede(e: unknown, expirou: boolean, isLeitura: boolean): ApiError {
  if (expirou) {
    return new ApiError(
      0,
      isLeitura
        ? 'O servidor demorou demais para responder. Tente novamente.'
        : 'O servidor demorou demais para responder. A ação pode ter sido concluída: confira a lista antes de tentar de novo.',
    );
  }
  if (isAbortError(e)) return new ApiError(0, 'Requisição cancelada.');
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Failed to fetch') || msg.includes('Network request failed')) {
    return new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.');
  }
  return new ApiError(0, 'Erro de conexão. Tente novamente.');
}

/**
 * Chamada SEM login (páginas públicas: responder pesquisa, ler feedback pelo link).
 * Mesmo timeout de 15 s e mesmas mensagens de erro do apiFetch; sem retry.
 */
export async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'URL da API não configurada.');
  const controller = new AbortController();
  let expirou = false;
  const timer = setTimeout(() => { expirou = true; controller.abort(); }, TIMEOUT_MS);
  const metodo = (options.method ?? 'GET').toUpperCase();
  const isLeitura = metodo === 'GET' || metodo === 'HEAD';
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
        signal: controller.signal,
      });
    } catch (e: unknown) {
      throw traduzirFalhaDeRede(e, expirou, isLeitura);
    }
    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body?.error || `Erro ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
