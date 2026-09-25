import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

const ctx = { sub: 4, company_id: 10, role: 'colaborador', name: 'Colaborador', email: 'c@empresa.com' };

describe('PATCH /api/onboarding/:id/step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue(ctx);
  });

  it('impede que papel não responsável conclua etapa de onboarding', async () => {
    mockSql.mockResolvedValueOnce([{
      id: 42,
      completed_at: null,
      steps_progress: {},
      steps_snapshot: [{ title: 'Cadastrar', responsible_role: 'rh' }],
    }]);
    const { default: handler } = await import('../api/onboarding/index');
    const res = makeRes();

    await handler({
      method: 'PATCH', query: { id: '42', step: 'true' },
      headers: { authorization: 'Bearer token' }, body: { step_index: 0, completed: true },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/onboarding', () => {
  it('restringe a limpeza do processo anterior à empresa autenticada', async () => {
    mockAuthenticate.mockReturnValue({ ...ctx, role: 'rh' });
    mockSql
      .mockResolvedValueOnce([{ id: 8, name: 'Ana' }])
      .mockResolvedValueOnce([{ id: 3, name: 'Padrão', steps: [] }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 99, company_id: 10 }]);
    const { default: handler } = await import('../api/onboarding/index');
    const res = makeRes();

    await handler({
      method: 'POST', query: {}, headers: { authorization: 'Bearer token' }, body: { employee_id: 8 },
    } as any, res);

    const cleanupQuery = String(mockSql.mock.calls[2][0]);
    expect(cleanupQuery).toContain('company_id');
    expect(mockSql.mock.calls[2].flat()).toContain(10);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
