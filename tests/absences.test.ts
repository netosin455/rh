// tests/absences.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockCors = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: any[]) => mockSql(...args),
  cors: (res: any) => mockCors(res),
  authenticate: (req: any) => mockAuthenticate(req),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_APPROVE_ABSENCES: ['super_admin', 'admin', 'rh', 'adm', 'gestor'],
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  res.end    = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(method: string, body?: any, query?: any) {
  return { method, body: body ?? {}, query: query ?? {}, headers: { authorization: 'Bearer token' } } as any;
}

const rhCtx = { sub: 1, company_id: 10, role: 'rh', name: 'RH', email: 'rh@t.com' };

describe('POST /api/absences', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_create_absence_falha_employee_outra_empresa — retorna 404', async () => {
    mockAuthenticate.mockReturnValue(rhCtx);
    mockSql.mockResolvedValueOnce([]); // empCheck retorna vazio (funcionário de outra empresa)
    const { default: handler } = await import('../api/absences/index');
    const req = makeReq('POST', {
      employee_id: 999,
      type: 'ferias',
      start_date: '2026-07-01',
      end_date: '2026-07-30',
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('test_create_absence_falha_type_invalido — retorna 400', async () => {
    mockAuthenticate.mockReturnValue(rhCtx);
    const { default: handler } = await import('../api/absences/index');
    const req = makeReq('POST', {
      employee_id: 1,
      type: 'sabado',
      start_date: '2026-07-01',
      end_date: '2026-07-02',
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
