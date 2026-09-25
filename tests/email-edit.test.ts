// tests/email-edit.test.ts — email do colaborador e edição do próprio email na Admin
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: any[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (req: any) => mockAuthenticate(req),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  VALID_ROLES: ['super_admin', 'admin', 'rh', 'gestor', 'colaborador', 'financeiro', 'juridico', 'ti', 'adm'],
  parsePagination: () => ({ page: 1, limit: 50, offset: 0 }),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
  hash: vi.fn().mockResolvedValue('hashed'),
}));

const rhCtx = { sub: 5, company_id: 10, role: 'rh', name: 'RH', email: 'rh@test.com' };
const superCtx = { sub: 1, company_id: 10, role: 'super_admin', name: 'Carlo', email: 'carlo@test.com' };

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(method: string, body?: any, query?: any) {
  return { method, body: body ?? {}, query: query ?? {}, headers: { authorization: 'Bearer t' } } as any;
}

/** Valores interpolados (não o texto SQL) da chamada que contém o trecho informado. */
function paramsOfCallContaining(fragment: string): any[] | undefined {
  const call = mockSql.mock.calls.find(([strings]) => Array.isArray(strings) && strings.join('?').includes(fragment));
  return call ? call.slice(1) : undefined;
}

describe('normalizeOptionalEmail', () => {
  it('test_normalize_vazio_vira_null_e_valido_vai_para_minusculas', async () => {
    const { normalizeOptionalEmail } = await import('../api/_email');
    expect(normalizeOptionalEmail(undefined)).toEqual({ ok: true, value: null });
    expect(normalizeOptionalEmail('   ')).toEqual({ ok: true, value: null });
    expect(normalizeOptionalEmail('  Ana@Empresa.COM ')).toEqual({ ok: true, value: 'ana@empresa.com' });
  });

  it('test_normalize_rejeita_formato_invalido_e_tipo_errado', async () => {
    const { normalizeOptionalEmail } = await import('../api/_email');
    expect(normalizeOptionalEmail('sem-arroba')).toEqual({ ok: false });
    expect(normalizeOptionalEmail('a@b')).toEqual({ ok: false });
    expect(normalizeOptionalEmail(123)).toEqual({ ok: false });
  });
});

describe('PUT /api/employees/:id — email', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthenticate.mockReturnValue(rhCtx); });

  it('test_put_email_invalido_retorna_422_sem_tocar_no_banco', async () => {
    const { default: handler } = await import('../api/employees/index');
    const res = makeRes();
    await handler(makeReq('PUT', { email: 'nao-e-email' }, { id: '7' }), res);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('test_put_email_valido_grava_normalizado_e_marca_como_informado', async () => {
    mockSql.mockResolvedValue([{ id: 7, email: 'ana@empresa.com' }]);
    const { default: handler } = await import('../api/employees/index');
    const res = makeRes();
    await handler(makeReq('PUT', { email: ' Ana@Empresa.com ' }, { id: '7' }), res);
    const params = paramsOfCallContaining('UPDATE employees');
    expect(params).toContain(true);            // emailProvided
    expect(params).toContain('ana@empresa.com');
    expect(res.status).not.toHaveBeenCalledWith(422);
  });

  it('test_put_email_vazio_apaga_o_email', async () => {
    mockSql.mockResolvedValue([{ id: 7, email: null }]);
    const { default: handler } = await import('../api/employees/index');
    await handler(makeReq('PUT', { email: '' }, { id: '7' }), makeRes());
    const params = paramsOfCallContaining('UPDATE employees');
    expect(params).toContain(true);            // informado
    expect(params).toContain(null);            // valor apagado
  });

  it('test_put_sem_campo_email_nao_altera_o_email', async () => {
    mockSql.mockResolvedValue([{ id: 7 }]);
    const { default: handler } = await import('../api/employees/index');
    await handler(makeReq('PUT', { role_title: 'Analista' }, { id: '7' }), makeRes());
    const params = paramsOfCallContaining('UPDATE employees');
    expect(params).toContain(false);           // emailProvided = false
  });

  it('test_put_perfil_sem_permissao_retorna_403', async () => {
    mockAuthenticate.mockReturnValue({ ...rhCtx, role: 'colaborador' });
    const { default: handler } = await import('../api/employees/index');
    const res = makeRes();
    await handler(makeReq('PUT', { email: 'a@b.com' }, { id: '7' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSql).not.toHaveBeenCalled();
  });
});

describe('POST /api/employees — email', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthenticate.mockReturnValue(rhCtx); });

  const base = { name: 'Ana', hire_date: '2026-01-10', role_title: 'Analista' };

  it('test_post_email_invalido_retorna_422', async () => {
    const { default: handler } = await import('../api/employees/index');
    const res = makeRes();
    await handler(makeReq('POST', { ...base, email: 'xxx' }), res);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('test_post_sem_email_cria_com_email_nulo', async () => {
    mockSql.mockResolvedValue([{ id: 9 }]);
    const { default: handler } = await import('../api/employees/index');
    const res = makeRes();
    await handler(makeReq('POST', base), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(paramsOfCallContaining('INSERT INTO employees')).toContain(null);
  });
});

describe('PUT /api/users/:id — editar o próprio email', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuthenticate.mockReturnValue(superCtx); });

  it('test_propria_conta_permite_trocar_nome_e_email', async () => {
    mockSql
      .mockResolvedValueOnce([])                                   // email livre
      .mockResolvedValueOnce([{ id: 1, email: 'novo@test.com' }]); // UPDATE
    const { default: handler } = await import('../api/users/index');
    const res = makeRes();
    await handler(makeReq('PUT', { name: 'Carlo', email: 'Novo@Test.com', role: 'super_admin' }, { id: '1' }), res);
    expect(res.json).toHaveBeenCalledWith({ id: 1, email: 'novo@test.com' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('test_propria_conta_continua_bloqueando_mudar_o_proprio_cargo', async () => {
    const { default: handler } = await import('../api/users/index');
    const res = makeRes();
    await handler(makeReq('PUT', { role: 'colaborador' }, { id: '1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('test_propria_conta_continua_bloqueando_trocar_senha_por_aqui', async () => {
    const { default: handler } = await import('../api/users/index');
    const res = makeRes();
    await handler(makeReq('PUT', { password: 'nova-senha-123' }, { id: '1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('test_email_ja_usado_por_outra_conta_retorna_409', async () => {
    mockSql.mockResolvedValueOnce([{ id: 2 }]);
    const { default: handler } = await import('../api/users/index');
    const res = makeRes();
    await handler(makeReq('PUT', { email: 'outro@test.com' }, { id: '1' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('test_email_invalido_retorna_422', async () => {
    const { default: handler } = await import('../api/users/index');
    const res = makeRes();
    await handler(makeReq('PUT', { email: 'sem-arroba' }, { id: '1' }), res);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
