import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: () => mockAuthenticate(),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  parsePagination: () => ({ page: 1, limit: 50, offset: 0 }),
}));

vi.mock('../helpers/validacoes', () => ({ validarCPF: () => true }));
vi.mock('../api/_email', () => ({ normalizeOptionalEmail: () => ({ ok: true, value: null }) }));

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function makeResponse(): MockResponse {
  const response = {} as MockResponse;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  response.end = vi.fn().mockReturnValue(response);
  return response;
}

function makeRequest(
  method: string,
  body: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
): VercelRequest {
  return { method, body, query, headers: {} } as unknown as VercelRequest;
}

function hasWrite(): boolean {
  return mockSql.mock.calls.some((call) => /(?:INSERT INTO|UPDATE) employees/.test(String(call[0])));
}

describe('isolamento de empresa em /api/employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 7, company_id: 10, role: 'rh' });
  });

  it('POST rejeita departamento de outra empresa sem inserir', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/employees/index');
    const response = makeResponse();

    await handler(
      makeRequest('POST', { name: 'Ana', hire_date: '2026-10-01', role_title: 'Analista', department_id: 99 }),
      response as unknown as VercelResponse,
    );

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('POST rejeita gestor de outra empresa sem inserir', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/employees/index');
    const response = makeResponse();

    await handler(
      makeRequest('POST', { name: 'Ana', hire_date: '2026-10-01', role_title: 'Analista', manager_id: 88 }),
      response as unknown as VercelResponse,
    );

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('PUT rejeita departamento de outra empresa sem atualizar', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/employees/index');
    const response = makeResponse();

    await handler(makeRequest('PUT', { department_id: 99 }, { id: '15' }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('PUT rejeita gestor de outra empresa sem atualizar', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/employees/index');
    const response = makeResponse();

    await handler(makeRequest('PUT', { manager_id: 88 }, { id: '15' }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('GET condiciona o departamento à empresa do colaborador', async () => {
    mockSql
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ id: 15, department_name: null, status: 'ativo' }]);
    const { default: handler } = await import('../api/employees/index');
    const response = makeResponse();

    await handler(makeRequest('GET'), response as unknown as VercelResponse);

    const departmentQuery = mockSql.mock.calls.find((call) => String(call[0]).includes('LEFT JOIN departments'));
    expect(String(departmentQuery?.[0])).toContain('d.company_id = e.company_id');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ department_name: null })] }));
  });
});
