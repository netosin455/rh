import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: () => mockAuthenticate(),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  IS_ADMIN: ['super_admin', 'admin'],
  parsePagination: () => ({ page: 1, limit: 10, offset: 0 }),
}));

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
  return mockSql.mock.calls.some((call) => /(?:INSERT INTO|UPDATE) events/.test(String(call[0])));
}

describe('isolamento de empresa em /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 7, company_id: 10, role: 'admin' });
  });

  it('POST rejeita processo de outra empresa sem inserir', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/events/index');
    const response = makeResponse();

    await handler(makeRequest('POST', { title: 'Audiência', date: '2026-10-10', case_id: 44 }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('PUT rejeita processo de outra empresa sem atualizar', async () => {
    mockSql
      .mockResolvedValueOnce([{ user_id: 7 }])
      .mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/events/index');
    const response = makeResponse();

    await handler(makeRequest('PUT', { case_id: 44 }, { id: '13' }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(hasWrite()).toBe(false);
  });

  it('GET condiciona dados do processo à empresa do evento', async () => {
    mockSql.mockResolvedValue([{ id: 13, case_number: null, case_title: null }]);
    const { default: handler } = await import('../api/events/index');
    const response = makeResponse();

    await handler(makeRequest('GET', {}, { upcoming: 'true', limit: '9999' }), response as unknown as VercelResponse);

    const caseQuery = mockSql.mock.calls.find((call) => String(call[0]).includes('LEFT JOIN legal_cases'));
    expect(String(caseQuery?.[0])).toContain('c.company_id = e.company_id');
    expect(response.json).toHaveBeenCalledWith([{ id: 13, case_number: null, case_title: null }]);
  });
});
