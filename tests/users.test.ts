// tests/users.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────
const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockCors = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: any[]) => mockSql(...args),
  cors: (res: any) => mockCors(res),
  authenticate: (req: any) => mockAuthenticate(req),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  VALID_ROLES: ['super_admin','admin','rh','gestor','colaborador','financeiro','juridico','ti','adm'],
  parsePagination: (query: any, opts: any = {}) => {
    const { defaultLimit = 50, maxLimit = 100 } = opts;
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
  },
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
  hash: vi.fn().mockResolvedValue('hashed'),
}));

const superAdminCtx = { sub: 1, company_id: 10, role: 'super_admin', name: 'Admin', email: 'admin@test.com' };

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

// ── Index handler (GET + POST) ────────────────────────────────
describe('GET /api/users', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_acesso_negado_sem_super_admin — retorna 403 para role rh', async () => {
    mockAuthenticate.mockReturnValue({ ...superAdminCtx, role: 'rh' });
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('GET');
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna lista de usuários para super_admin', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    mockSql.mockResolvedValue([{ id: 2, name: 'User', email: 'u@t.com', role: 'rh' }]);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('GET');
    const res = makeRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});

describe('POST /api/users', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_create_user_sucesso_com_dados_validos — retorna 201', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    mockSql
      .mockResolvedValueOnce([])   // email check — não existe
      .mockResolvedValueOnce([{ id: 5, company_id: 10, name: 'Novo', email: 'novo@t.com', role: 'rh', created_at: new Date() }]);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('POST', { name: 'Novo', email: 'novo@t.com', password: 'senha123', role: 'rh' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('test_create_user_falha_com_email_duplicado — retorna 409', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    mockSql.mockResolvedValueOnce([{ id: 3 }]);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('POST', { name: 'X', email: 'dup@t.com', password: 'senha123', role: 'rh' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('test_create_user_falha_com_senha_curta — retorna 400', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('POST', { name: 'X', email: 'x@t.com', password: '123', role: 'rh' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('test_create_user_falha_com_role_invalido — retorna 400', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('POST', { name: 'X', email: 'x@t.com', password: 'senha123', role: 'hacker' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── [id] handler (PUT + DELETE) ───────────────────────────────
describe('PUT /api/users/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_update_user_falha_com_nome_vazio — retorna 400', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx);
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('PUT', { name: '   ' }, { id: '99' });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('DELETE /api/users/:id', () => {
  beforeEach(() => { vi.clearAllMocks(); mockCors.mockReturnValue(undefined); });

  it('test_delete_user_falha_auto_exclusao — retorna 400', async () => {
    mockAuthenticate.mockReturnValue(superAdminCtx); // sub: 1
    const { default: handler } = await import('../api/users/index');
    const req = makeReq('DELETE', {}, { id: '1' }); // mesma id do sub
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
