// tests/auth-401.test.ts
// Handler global de 401: a camada HTTP limpa o storage e avisa quem se registrou
// (o AuthProvider), sem depender de React.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const armazenamento = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => armazenamento.get(k) ?? null,
    setItem: async (k: string, v: string) => { armazenamento.set(k, v); },
    removeItem: async (k: string) => { armazenamento.delete(k); },
  },
}));

const mockFetch = vi.fn();
const resposta = (status: number, corpo: unknown = {}): Response => ({ ok: status < 400, status, json: async () => corpo } as Response);

async function carregar() {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.teste');
  return import('../conexoes/http');
}

describe('setUnauthorizedHandler', () => {
  beforeEach(() => {
    armazenamento.clear();
    armazenamento.set('@superrh:token', 'tok');
    armazenamento.set('@superrh:user', '{"id":1}');
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('401: limpa o storage ANTES de chamar o handler, chama uma vez e propaga ApiError 401', async () => {
    mockFetch.mockResolvedValue(resposta(401));
    const { apiFetch, setUnauthorizedHandler } = await carregar();
    const storageNoHandler: number[] = [];
    const handler = vi.fn(() => { storageNoHandler.push(armazenamento.size); });
    setUnauthorizedHandler(handler);

    await expect(apiFetch('/api/employees')).rejects.toMatchObject({ name: 'ApiError', status: 401, message: 'Sessão expirada. Faça login novamente.' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(storageNoHandler).toEqual([0]);
  });

  it('remover o handler (cleanup do provider) para as chamadas', async () => {
    mockFetch.mockResolvedValue(resposta(401));
    const { apiFetch, setUnauthorizedHandler } = await carregar();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setUnauthorizedHandler(null);
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('handler que lança não esconde o 401 de quem chamou', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch.mockResolvedValue(resposta(401));
    const { apiFetch, setUnauthorizedHandler } = await carregar();
    setUnauthorizedHandler(() => { throw new Error('boom'); });
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 });
    aviso.mockRestore();
  });

  it('outros erros (403, 500) e sucesso não disparam o handler nem limpam a sessão', async () => {
    const { apiFetch, setUnauthorizedHandler } = await carregar();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch.mockResolvedValueOnce(resposta(403, { error: 'Sem permissão' }));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 403 });
    mockFetch.mockResolvedValueOnce(resposta(500, {}));
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 500 });
    mockFetch.mockResolvedValueOnce(resposta(200, { ok: true }));
    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: true });
    expect(handler).not.toHaveBeenCalled();
    expect(armazenamento.size).toBe(2);
  });

  it('chamada pública (sem login) com 401 não mexe na sessão nem no handler', async () => {
    mockFetch.mockResolvedValue(resposta(401, { error: 'não autorizado' }));
    const { publicFetch, setUnauthorizedHandler } = await carregar();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(publicFetch('/api/surveys/1')).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
    expect(armazenamento.size).toBe(2);
  });
});
