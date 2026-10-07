import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
}));

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn().mockReturnValue(result);
  result.json = vi.fn().mockReturnValue(result);
  result.end = vi.fn().mockReturnValue(result);
  return result;
}
function request(id: string): VercelRequest {
  return { method: 'DELETE', query: { id }, headers: { authorization: 'Bearer teste' } } as unknown as VercelRequest;
}

describe('DELETE /api/feedbacks/:id', () => {
  // O primeiro import do handler compila TypeScript e, com a máquina ocupada, passava dos 5 s do teste.
  // Importar uma vez aqui, com folga, deixa os testes instantâneos (mesmo remédio do teste de reconhecimentos).
  beforeAll(async () => {
    await import('../api/feedback/_handler');
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks não esvazia a fila de mockResolvedValueOnce: um teste que falha deixaria sobras no seguinte.
    mockSql.mockReset();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
  });

  for (const status of ['draft', 'published', 'acknowledged', 'revoked'] as const) {
    it(`remove feedback ${status} sem expor conteúdo no log`, async () => {
      mockSql.mockResolvedValueOnce([{ id: 8, company_id: 10, status }]);
      const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const { handleFeedbackAdmin } = await import('../api/feedback/_handler');
      const res = response();
      await handleFeedbackAdmin(request('8'), res as unknown as VercelResponse);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ feedback_id: 8, company_id: 10, previous_status: status }));
      log.mockRestore();
    });
  }

  it('retorna 404 para feedback de outra empresa sem excluir', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { handleFeedbackAdmin } = await import('../api/feedback/_handler');
    const res = response();
    await handleFeedbackAdmin(request('8'), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSql.mock.calls[0].flat()).toContain(10);
  });
});
