import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  sendPush: vi.fn(),
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

describe('POST /api/surveys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh', name: 'RH', email: 'rh@empresa.com' });
  });

  it('rejeita departamento que não pertence à empresa do JWT', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/surveys/index');
    const res = makeRes();

    await handler({
      method: 'POST', query: {}, headers: { authorization: 'Bearer token' },
      body: { title: 'Clima', question: 'Como você está?', type: 'scale', target_dept: 999, company_id: 99 },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSql.mock.calls.flat()).toContain(10);
    expect(mockSql.mock.calls.flat()).not.toContain(99);
  });
});
