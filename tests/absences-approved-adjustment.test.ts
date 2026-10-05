import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockUpdateApproved = vi.fn();
const mockDeleteApproved = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args), cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: MockResponse, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  CAN_APPROVE_ABSENCES: ['super_admin', 'admin', 'rh', 'adm', 'gestor'],
  ABSENCE_VALID_TYPES: ['ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'folga', 'falta', 'outro'],
  parsePagination: () => ({ page: 1, limit: 50, offset: 0 }),
  createAbsenceRecord: vi.fn(), resolveAbsenceApproval: vi.fn(),
  updateApprovedAbsenceRecord: (...args: unknown[]) => mockUpdateApproved(...args),
  deleteApprovedAbsenceRecord: (...args: unknown[]) => mockDeleteApproved(...args),
}));

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn().mockReturnValue(result);
  result.json = vi.fn().mockReturnValue(result);
  result.end = vi.fn().mockReturnValue(result);
  return result;
}
function request(method: string, body: unknown = {}): VercelRequest {
  return { method, query: { id: '15' }, body, headers: { authorization: 'Bearer teste' } } as unknown as VercelRequest;
}
const folga = { employee_id: 3, type: 'folga', start_date: '2026-10-01', end_date: '2026-10-01', reason: null, hours: 2, days_count: 1, status: 'aprovado' };
const ferias = { ...folga, type: 'ferias', hours: null, days_count: 3 };

describe('ajuste de lançamentos aprovados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateApproved.mockResolvedValue({ ok: true, absence: { id: 15 } });
    mockDeleteApproved.mockResolvedValue(true);
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
  });

  it('excluir folga aprovada devolve horas no mesmo comando', async () => {
    mockSql.mockResolvedValueOnce([folga]);
    const { default: handler } = await import('../api/absences/index');
    const res = response();
    await handler(request('DELETE'), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(mockDeleteApproved).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'folga', hours: 2 }));
  });

  it('editar folga aprovada ajusta somente a diferença e bloqueia saldo insuficiente', async () => {
    mockSql.mockResolvedValueOnce([folga]).mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/absences/index');
    await handler(request('PATCH', { hours: 4 }), response() as unknown as VercelResponse);
    expect(mockUpdateApproved).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'folga' }), expect.objectContaining({ hours: 4 }));

    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
    mockSql.mockResolvedValueOnce([folga]).mockResolvedValueOnce([]);
    mockUpdateApproved.mockResolvedValueOnce({ ok: false, status: 422, error: 'Saldo insuficiente' });
    const insufficient = response();
    await handler(request('PATCH', { hours: 50 }), insufficient as unknown as VercelResponse);
    expect(insufficient.status).toHaveBeenCalledWith(422);
  });

  it('férias aprovadas devolvem dias ao excluir e falta não altera saldo', async () => {
    mockSql.mockResolvedValueOnce([ferias]);
    const { default: handler } = await import('../api/absences/index');
    await handler(request('DELETE'), response() as unknown as VercelResponse);
    expect(mockDeleteApproved).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'ferias', days_count: 3 }));

    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
    mockSql.mockResolvedValueOnce([{ ...folga, type: 'falta', hours: 8 }]);
    await handler(request('DELETE'), response() as unknown as VercelResponse);
    expect(mockDeleteApproved).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'falta' }));
  });

  it('pendente continua sem saldo e outra empresa retorna 404', async () => {
    mockSql.mockResolvedValueOnce([{ ...folga, status: 'pendente' }]).mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/absences/index');
    await handler(request('DELETE'), response() as unknown as VercelResponse);
    expect(String(mockSql.mock.calls[1][0])).toContain("status = 'pendente'");

    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
    mockSql.mockResolvedValueOnce([]);
    const absent = response();
    await handler(request('DELETE'), absent as unknown as VercelResponse);
    expect(absent.status).toHaveBeenCalledWith(404);
  });

  it('não declara exclusão aprovada bem-sucedida quando o segundo pedido não encontra a linha', async () => {
    mockSql.mockResolvedValueOnce([folga]);
    mockDeleteApproved.mockResolvedValueOnce(false);
    const { default: handler } = await import('../api/absences/index');
    const res = response();
    await handler(request('DELETE'), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(204);
  });
});
