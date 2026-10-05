import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args), cors: vi.fn(),
  authenticate: () => ({ sub: 1, company_id: 10, role: 'rh' }),
  err: (res: MockResponse, status: number, message: string) => res.status(status).json({ error: message }),
  IS_ADMIN: ['super_admin', 'admin'], parsePagination: () => ({ page: 1, limit: 10, offset: 0 }),
}));
type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn().mockReturnValue(result); result.json = vi.fn().mockReturnValue(result); result.end = vi.fn().mockReturnValue(result);
  return result;
}
function request(body: Record<string, unknown>): VercelRequest {
  return { method: 'PUT', query: { id: '9' }, headers: {}, body } as unknown as VercelRequest;
}

describe('PUT /api/events/:id — horários', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aceita null explícito e limpa os dois horários em evento de dia inteiro', async () => {
    mockSql.mockResolvedValueOnce([{ user_id: 1 }]).mockResolvedValueOnce([{ id: 9, is_all_day: true }]);
    const { default: handler } = await import('../api/events/index');
    await handler(request({ start_time: null, end_time: null, is_all_day: true }), response() as unknown as VercelResponse);
    const update = mockSql.mock.calls[1];
    expect(String(update[0])).toContain('WHEN');
    expect(update.flat()).toContain(true);
    expect(update.flat()).toContain(null);
  });

  it('mantém horário quando o campo está ausente', async () => {
    mockSql.mockResolvedValueOnce([{ user_id: 1 }]).mockResolvedValueOnce([{ id: 9 }]);
    const { default: handler } = await import('../api/events/index');
    await handler(request({ title: 'Alterado' }), response() as unknown as VercelResponse);
    const update = mockSql.mock.calls[1];
    expect(update.flat()).toContain(false);
  });
});
