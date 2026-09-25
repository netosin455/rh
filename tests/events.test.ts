import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  IS_ADMIN: ['super_admin', 'admin'],
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

describe('GET /api/events?upcoming=true', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'colaborador', name: 'Ana', email: 'ana@empresa.com' });
  });

  it('calcula eventos futuros no fuso de São Paulo, sem antecipar o dia por UTC', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/events/index');
    const res = makeRes();

    await handler({
      method: 'GET', query: { upcoming: 'true' }, headers: { authorization: 'Bearer token' }, body: {},
    } as any, res);

    expect(String(mockSql.mock.calls[0][0])).toContain("America/Sao_Paulo");
    expect(res.json).toHaveBeenCalledWith([]);
  });
});
