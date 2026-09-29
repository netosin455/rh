// tests/colaboradores-paginacao.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockFetch = vi.fn();

function resposta(corpo: unknown): Response {
  return { ok: true, status: 200, json: async () => corpo } as Response;
}

function colaboradores(inicio: number, qtd: number) {
  return Array.from({ length: qtd }, (_, i) => ({ id: inicio + i, name: `Pessoa ${inicio + i}` }));
}

async function carregarGetEmployees() {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.teste');
  const modulo = await import('../conexoes/colaboradores');
  return modulo.getEmployees;
}

describe('getEmployees (paginação)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uma página: faz uma única requisição com limit=100', async () => {
    mockFetch.mockResolvedValueOnce(resposta({ data: colaboradores(1, 43), total: 43, page: 1, limit: 100, totalPages: 1 }));
    const getEmployees = await carregarGetEmployees();

    const lista = await getEmployees();

    expect(lista).toHaveLength(43);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('page=1&limit=100');
  });

  it('três páginas: busca as demais e concatena em ordem', async () => {
    mockFetch
      .mockResolvedValueOnce(resposta({ data: colaboradores(1, 100), total: 250, page: 1, limit: 100, totalPages: 3 }))
      .mockResolvedValueOnce(resposta({ data: colaboradores(101, 100), total: 250, page: 2, limit: 100, totalPages: 3 }))
      .mockResolvedValueOnce(resposta({ data: colaboradores(201, 50), total: 250, page: 3, limit: 100, totalPages: 3 }));
    const getEmployees = await carregarGetEmployees();

    const lista = await getEmployees();

    expect(lista).toHaveLength(250);
    expect(lista[0]?.id).toBe(1);
    expect(lista[249]?.id).toBe(250);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const urls = mockFetch.mock.calls.map((chamada) => String(chamada[0]));
    expect(urls.some((u) => u.includes('page=2&limit=100'))).toBe(true);
    expect(urls.some((u) => u.includes('page=3&limit=100'))).toBe(true);
  });

  it('formato inesperado lança erro em vez de devolver lista vazia', async () => {
    mockFetch.mockResolvedValueOnce(resposta([{ id: 1 }]));
    const getEmployees = await carregarGetEmployees();

    await expect(getEmployees()).rejects.toThrow('Resposta inesperada');
  });

  it('falha em uma página propaga o erro (sem lista truncada)', async () => {
    mockFetch
      .mockResolvedValueOnce(resposta({ data: colaboradores(1, 100), total: 150, page: 1, limit: 100, totalPages: 2 }))
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'falhou' }) } as Response);
    const getEmployees = await carregarGetEmployees();

    await expect(getEmployees()).rejects.toThrow('falhou');
  });
});
