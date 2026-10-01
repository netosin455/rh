import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: () => mockAuthenticate(),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  VALID_ROLES: ['super_admin', 'admin', 'rh', 'colaborador'],
  parsePagination: () => ({ page: 1, limit: 50, offset: 0 }),
}));

vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }));

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

function makeRequest(method: string, body: Record<string, unknown> = {}): VercelRequest {
  return { method, body, query: { notifications: '1' }, headers: {} } as unknown as VercelRequest;
}

describe('leituras individuais de notificações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a leitura de A não altera o estado da notificação para B', async () => {
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'colaborador' });
    mockSql.mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/users/index');
    const responseA = makeResponse();

    await handler(makeRequest('PATCH', { id: 77 }), responseA as unknown as VercelResponse);

    const insertCall = mockSql.mock.calls[0];
    expect(String(insertCall[0])).toContain('INSERT INTO notification_reads');
    expect(insertCall.flat()).toContain(1);
    expect(insertCall.flat()).not.toContain(2);

    mockAuthenticate.mockReturnValue({ sub: 2, company_id: 10, role: 'colaborador' });
    mockSql.mockResolvedValueOnce([{ id: 77, read: false }]);
    const responseB = makeResponse();

    await handler(makeRequest('GET'), responseB as unknown as VercelResponse);

    expect(responseB.json).toHaveBeenCalledWith({
      notifications: [{ id: 77, read: false }],
      unread: 1,
    });
  });
});
