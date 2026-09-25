import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: any, status: number, message: string) => res.status(status).json({ error: message }),
  IS_ADMIN: ['super_admin', 'admin'],
  parsePagination: () => ({ page: 1, limit: 20, offset: 0 }),
}));

vi.mock('../api/_email', () => ({
  buildRecognitionEmail: () => ({ subject: 'Reconhecimento', html: '<p>Reconhecimento</p>' }),
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

const rhCtx = { sub: 1, company_id: 10, role: 'rh', name: 'RH', email: 'rh@empresa.com' };

describe('POST /api/recognitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue(rhCtx);
  });

  it('mantém a criação quando o Resend falha', async () => {
    mockSql
      .mockResolvedValueOnce([{ name: 'Ana', email: 'ana@empresa.com' }])
      .mockResolvedValueOnce([{ id: 55, company_id: 10 }]);
    mockSendEmail.mockRejectedValueOnce(new Error('Resend respondeu 503'));
    const { default: handler } = await import('../api/recognitions/index');
    const res = makeRes();

    await handler({
      method: 'POST',
      query: {},
      headers: { authorization: 'Bearer token' },
      body: { to_employee_id: 7, message: 'Excelente parceria', category: 'trabalho_em_equipe' },
    } as any, res);

    expect(mockSendEmail).toHaveBeenCalledWith('ana@empresa.com', 'Reconhecimento', '<p>Reconhecimento</p>');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 55, company_id: 10 });
  });

  it('não cria nem envia email para colaborador de outra empresa', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/recognitions/index');
    const res = makeRes();

    await handler({
      method: 'POST',
      query: {},
      headers: { authorization: 'Bearer token' },
      body: { to_employee_id: 999, company_id: 99, message: 'Parabéns', category: 'outro' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSql.mock.calls.flat()).toContain(10);
    expect(mockSql.mock.calls.flat()).not.toContain(99);
  });
});
