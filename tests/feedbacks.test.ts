import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockFindPublicFeedback = vi.fn();
const mockCreateFeedbackPdf = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
}));

vi.mock('../api/feedback/_public', () => ({
  isFeedbackToken: (token: unknown) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token),
  findPublicFeedback: (...args: unknown[]) => mockFindPublicFeedback(...args),
}));

vi.mock('../api/feedback/_pdf', () => ({
  createFeedbackPdf: (...args: unknown[]) => mockCreateFeedbackPdf(...args),
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

const rhCtx = { sub: 1, company_id: 10, role: 'rh', name: 'RH', email: 'rh@empresa.com' };
const token = 'a'.repeat(43);

describe('API administrativa de feedbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue(rhCtx);
  });

  it('cria sempre como rascunho na empresa do JWT, ignorando company_id do body', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([{ id: 31, company_id: 10, status: 'draft' }]);
    const { handleFeedbackAdmin: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({
      method: 'POST', query: {}, headers: { authorization: 'Bearer token' },
      body: { employee_id: 7, company_id: 99, title: 'Desenvolvimento', content: 'Conteúdo do feedback.' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 31, company_id: 10, status: 'draft' });
    expect(mockSql.mock.calls.flat()).toContain(10);
    expect(mockSql.mock.calls.flat()).not.toContain(99);
  });

  it('não permite que papel sem gestão crie feedback', async () => {
    mockAuthenticate.mockReturnValue({ ...rhCtx, role: 'colaborador' });
    const { handleFeedbackAdmin: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'POST', query: {}, headers: { authorization: 'Bearer token' }, body: { employee_id: 7, title: 'x', content: 'x' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('não encontra um feedback de outra empresa mesmo com id válido', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { handleFeedbackAdmin: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'GET', query: { id: '999' }, headers: { authorization: 'Bearer token' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSql.mock.calls.flat()).toContain(10);
  });

  it('não publica novamente um feedback que já saiu do estado draft', async () => {
    mockSql.mockResolvedValueOnce([{ id: 31, status: 'published' }]);
    const { handleFeedbackAdmin: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'POST', query: { id: '31', action: 'publish' }, headers: { authorization: 'Bearer token' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

describe('API pública de feedbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expõe somente o conteúdo necessário por token, sem autenticação', async () => {
    mockFindPublicFeedback.mockResolvedValueOnce({
      title: 'Desenvolvimento', content: 'Conteúdo', status: 'published', published_at: '2026-09-29T12:00:00Z',
      acknowledged_at: null, employee_name: 'Ana', company_name: 'Empresa A',
    });
    const { handleFeedbackPublic: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'GET', query: { token }, headers: {} } as any, res);

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ employee_name: 'Ana', title: 'Desenvolvimento' }));
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store, max-age=0');
  });

  it('só confirma leitura quando o cliente declara ciência e grava o horário uma vez', async () => {
    mockFindPublicFeedback.mockResolvedValueOnce({
      title: 'Desenvolvimento', content: 'Conteúdo', status: 'published', published_at: '2026-09-29T12:00:00Z',
      acknowledged_at: null, employee_name: 'Ana', company_name: 'Empresa A',
    });
    mockSql.mockResolvedValueOnce([{ acknowledged_at: '2026-09-29T13:00:00Z' }]);
    const { handleFeedbackPublic: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'POST', query: { token, action: 'acknowledge' }, headers: {}, body: { acknowledged: true } } as any, res);

    expect(res.json).toHaveBeenCalledWith({ acknowledged_at: '2026-09-29T13:00:00Z', already_acknowledged: false });
    expect(String(mockSql.mock.calls[0][0])).toContain("status = 'published'");
  });

  it('rejeita confirmação sem a caixa de ciência marcada', async () => {
    const { handleFeedbackPublic: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'POST', query: { token, action: 'acknowledge' }, headers: {}, body: { acknowledged: false } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFindPublicFeedback).not.toHaveBeenCalled();
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('mantém o link inacessível quando o RH o revogou', async () => {
    mockFindPublicFeedback.mockResolvedValueOnce({
      title: 'Desenvolvimento', content: 'Conteúdo', status: 'revoked', published_at: '2026-09-29T12:00:00Z',
      acknowledged_at: null, employee_name: 'Ana', company_name: 'Empresa A',
    });
    const { handleFeedbackPublic: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'GET', query: { token }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(410);
  });

  it('entrega um PDF real pelo mesmo token ativo', async () => {
    mockFindPublicFeedback.mockResolvedValueOnce({
      title: 'Desenvolvimento', content: 'Conteúdo', status: 'acknowledged', published_at: '2026-09-29T12:00:00Z',
      acknowledged_at: '2026-09-29T13:00:00Z', employee_name: 'Ana', company_name: 'Empresa A',
    });
    mockCreateFeedbackPdf.mockResolvedValueOnce(new Uint8Array([37, 80, 68, 70]));
    const { handleFeedbackPublic: handler } = await import('../api/feedback/_handler');
    const res = makeRes();

    await handler({ method: 'GET', query: { token, action: 'pdf' }, headers: {} } as any, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
