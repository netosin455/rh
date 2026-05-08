// tests/notices.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockCors = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: any[]) => mockSql(...args),
  cors: (res: any) => mockCors(res),
  authenticate: (req: any) => mockAuthenticate(req),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
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

const adminCtx = { sub: 1, company_id: 10, role: 'admin', name: 'Admin', email: 'a@t.com' };

describe('POST /api/notices', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_create_notice_sucesso — retorna 201', async () => {
    mockAuthenticate.mockReturnValue(adminCtx);
    mockSql.mockResolvedValue([{ id: 1, title: 'Aviso', body: 'Texto', company_id: 10 }]);
    const { default: handler } = await import('../api/notices/index');
    const req = makeReq('POST', { title: 'Aviso', body: 'Texto' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('test_create_notice_falha_sem_permissao — retorna 403 para colaborador', async () => {
    mockAuthenticate.mockReturnValue({ ...adminCtx, role: 'colaborador' });
    const { default: handler } = await import('../api/notices/index');
    const req = makeReq('POST', { title: 'Aviso', body: 'Texto' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('PATCH /api/notices/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_pin_falha_sem_boolean — retorna 400 com body vazio', async () => {
    mockAuthenticate.mockReturnValue(adminCtx);
    const { default: handler } = await import('../api/notices/[id]');
    const req = makeReq('PATCH', {}, { id: '1' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
