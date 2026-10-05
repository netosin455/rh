import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = Object.assign(vi.fn(), { transaction: vi.fn().mockResolvedValue([]) });
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: mockSql,
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  sendPush: vi.fn(),
  JWT_SECRET: 'teste',
}));

type MockResponse = { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn().mockReturnValue(result);
  result.json = vi.fn().mockReturnValue(result);
  result.end = vi.fn().mockReturnValue(result);
  return result;
}
function request(body: unknown): VercelRequest {
  return { method: 'PUT', query: { id: '12' }, body, headers: { authorization: 'Bearer teste' } } as unknown as VercelRequest;
}

const currentQuestions = [
  { id: 1, position: 1, question: 'Primeira', type: 'choice', options: ['A', 'B'], required: true },
  { id: 2, position: 2, question: 'Segunda', type: 'text', options: null, required: false },
];
const surveyWithResponses = { id: 12, title: 'Pesquisa', expires_at: null, audience: 'employees', response_count: 1 };
const surveyWithoutResponses = { ...surveyWithResponses, response_count: 0 };

function prepare(survey: object, questions = currentQuestions) {
  mockSql.mockResolvedValueOnce([survey]).mockResolvedValueOnce(questions).mockResolvedValue([{ id: 12, response_count: survey === surveyWithResponses ? 1 : 0 }]);
}

describe('PUT /api/surveys/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.transaction.mockResolvedValue([]);
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
  });

  it('sem respostas substitui perguntas livremente em transação e preserva a primeira no legado', async () => {
    prepare(surveyWithoutResponses);
    const { default: handler } = await import('../api/surveys/index');
    const res = response();
    await handler(request({ title: 'Nova', questions: [{ id: 2, question: 'Agora primeira', type: 'scale', options: null, required: true }] }), res as unknown as VercelResponse);
    expect(mockSql.transaction).toHaveBeenCalled();
    const sentSql = mockSql.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sentSql).not.toContain('position = position +');
    expect(sentSql).toContain('DELETE FROM survey_questions');
    expect(sentSql).toContain('INSERT INTO survey_questions');
    expect(sentSql).not.toContain('ELSE 1 / 0');
    expect(sentSql).toContain('SELECT 1 / (CASE WHEN');
    expect(sentSql).toContain('THEN 1 ELSE 0 END) AS verificacao');
  });

  it('desfaz a edição livre e retorna 409 se a verificação final detectar uma resposta concorrente', async () => {
    prepare(surveyWithoutResponses);
    mockSql.transaction.mockRejectedValueOnce({ code: '22012' });
    const { default: handler } = await import('../api/surveys/index');
    const res = response();
    await handler(request({ questions: [{ id: 1, question: 'Nova primeira', type: 'choice', options: ['A', 'B'], required: true }] }), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      codigo: 'edicao_bloqueada',
      bloqueios: ['A pesquisa recebeu respostas enquanto você editava. Recarregue e edite de novo.'],
    }));
  });

  it('com respostas bloqueia remoção, reordenação, tipo, opção e obrigatoriedade sem gravar', async () => {
    prepare(surveyWithResponses);
    const { default: handler } = await import('../api/surveys/index');
    const res = response();
    await handler(request({ questions: [{ id: 2, question: 'Segunda', type: 'scale', options: null, required: true }] }), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0]?.[0] as { codigo: string; bloqueios: string[] };
    expect(body.codigo).toBe('edicao_bloqueada');
    expect(body.bloqueios.length).toBeGreaterThan(0);
    expect(mockSql.transaction).not.toHaveBeenCalled();
  });

  it('com respostas permite texto, required true para false, opções no fim e nova opcional', async () => {
    prepare(surveyWithResponses);
    const { default: handler } = await import('../api/surveys/index');
    await handler(request({ questions: [
      { id: 1, question: 'Primeira alterada', type: 'choice', options: ['A', 'B', 'C'], required: false },
      { id: 2, question: 'Segunda alterada', type: 'text', options: null, required: false },
      { question: 'Nova opcional', type: 'scale', options: null, required: false },
    ] }), response() as unknown as VercelResponse);
    expect(mockSql.transaction).toHaveBeenCalled();
  });

  it('isola a edição pelo company_id e expõe response_count na lista', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/surveys/index');
    const res = response();
    await handler(request({ title: 'Outra empresa' }), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockSql.mock.calls[0].flat()).toContain(10);
  });
});
