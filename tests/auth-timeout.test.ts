// tests/auth-timeout.test.ts
// Login com API lenta ou fora do ar termina no timeout (15 s) com erro claro e consistente.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn().mockResolvedValue(null), removeItem: vi.fn().mockResolvedValue(undefined), setItem: vi.fn().mockResolvedValue(undefined) },
}));

const mockFetch = vi.fn();

/** fetch que nunca responde, mas obedece ao AbortController (como o fetch de verdade). */
function fetchTravado(): typeof fetch {
  return ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
  })) as typeof fetch;
}

function resposta(status: number, corpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

async function carregar() {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.teste');
  const [{ fazerLogin }, { ApiError, setUnauthorizedHandler, TIMEOUT_MS }] = await Promise.all([import('../conexoes/autenticacao'), import('../conexoes/http')]);
  return { fazerLogin, ApiError, setUnauthorizedHandler, TIMEOUT_MS };
}

describe('fazerLogin', () => {
  beforeEach(() => { mockFetch.mockReset(); vi.stubGlobal('fetch', mockFetch); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('API lenta: aborta no timeout de 15 s com mensagem clara (status 0)', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(fetchTravado());
    const { fazerLogin, ApiError, TIMEOUT_MS } = await carregar();
    expect(TIMEOUT_MS).toBe(15_000);

    const promessa = fazerLogin('rh', 'senha');
    const verificacao = expect(promessa).rejects.toMatchObject({ name: 'ApiError', status: 0, message: 'O servidor demorou demais para responder. Tente novamente.' });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    await verificacao;
    await expect(promessa).rejects.toBeInstanceOf(ApiError);
  });

  it('antes do timeout continua esperando (não corta cedo)', async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation(fetchTravado());
    const { fazerLogin } = await carregar();
    let terminou = false;
    fazerLogin('rh', 'senha').catch(() => { terminou = true; });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(terminou).toBe(false);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(terminou).toBe(true);
  });

  it('offline: mesma família de erro (ApiError status 0) com mensagem de conexão', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const { fazerLogin } = await carregar();
    await expect(fazerLogin('rh', 'senha')).rejects.toMatchObject({ name: 'ApiError', status: 0, message: 'Sem conexão com o servidor. Verifique sua internet.' });
  });

  it('senha errada: mostra a mensagem do servidor e NÃO dispara o handler de sessão expirada', async () => {
    mockFetch.mockResolvedValue(resposta(401, { error: 'Usuário ou senha inválidos' }));
    const { fazerLogin, setUnauthorizedHandler } = await carregar();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(fazerLogin('rh', 'errada')).rejects.toMatchObject({ status: 401, message: 'Usuário ou senha inválidos' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('erro sem mensagem do servidor mantém o texto antigo "Erro ao fazer login"', async () => {
    mockFetch.mockResolvedValue(resposta(500, {}));
    const { fazerLogin } = await carregar();
    await expect(fazerLogin('rh', 'senha')).rejects.toMatchObject({ status: 500, message: 'Erro ao fazer login' });
  });

  it('sucesso: normaliza o usuário (minúsculas, sem espaços) e devolve token + usuário', async () => {
    mockFetch.mockResolvedValue(resposta(200, { token: 't', user: { id: 1, role: 'rh' } }));
    const { fazerLogin } = await carregar();
    await expect(fazerLogin('  RH.Carlos ', 'senha')).resolves.toEqual({ token: 't', user: { id: 1, role: 'rh' } });
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({ username: 'rh.carlos', password: 'senha' });
  });
});
