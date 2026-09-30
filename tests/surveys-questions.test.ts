import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: { status: (status: number) => { json: (body: unknown) => unknown } }, status: number, message: string) => res.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  sendPush: vi.fn(),
}));

function makeResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    end: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  response.end.mockReturnValue(response);
  return response;
}

function publicRequest(body: unknown): VercelRequest {
  return {
    method: 'POST',
    query: { id: '12', respond: 'true' },
    headers: {},
    body,
  } as unknown as VercelRequest;
}

const survey = { id: 12, expires_at: null, question: 'Legado', type: 'scale', options: null };
const questions = [
  { id: 101, position: 1, question: 'Como você avalia?', type: 'scale', options: null, required: true },
  { id: 102, position: 2, question: 'Escolha uma opção', type: 'choice', options: ['Sim', 'Não'], required: true },
  { id: 103, position: 3, question: 'Conte mais', type: 'text', options: null, required: false },
];

function prepareSurvey() {
  mockSql.mockResolvedValueOnce([survey]).mockResolvedValueOnce(questions);
}

function hasSubmissionInsert(): boolean {
  return mockSql.mock.calls.some(([query]) => String(query).includes('INSERT INTO survey_submissions'));
}

describe('POST /api/surveys/:id/respond com perguntas próprias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
  });

  it('recusa obrigatória ausente sem gravar participação parcial', async () => {
    prepareSurvey();
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicRequest({ answers: [{ question_id: 101, score: 5 }] }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(hasSubmissionInsert()).toBe(false);
  });

  it('recusa opção fora da lista sem gravar participação parcial', async () => {
    prepareSurvey();
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicRequest({ answers: [{ question_id: 101, score: 5 }, { question_id: 102, choice: 'Talvez' }] }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(hasSubmissionInsert()).toBe(false);
  });

  it('recusa texto acima do limite sem gravar participação parcial', async () => {
    prepareSurvey();
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicRequest({ answers: [
      { question_id: 101, score: 5 },
      { question_id: 102, choice: 'Sim' },
      { question_id: 103, text: 'x'.repeat(1001) },
    ] }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(hasSubmissionInsert()).toBe(false);
  });

  it('recusa pergunta de outra pesquisa sem gravar participação parcial', async () => {
    prepareSurvey();
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicRequest({ answers: [
      { question_id: 101, score: 5 },
      { question_id: 102, choice: 'Sim' },
      { question_id: 999, text: 'Resposta indevida' },
    ] }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(hasSubmissionInsert()).toBe(false);
  });

  it('retorna 409 quando o dispositivo já enviou a pesquisa', async () => {
    prepareSurvey();
    mockSql.mockResolvedValueOnce([{ exists: 1 }]);
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicRequest({
      voter_token: 'dispositivo-anonimo',
      answers: [{ question_id: 101, score: 5 }, { question_id: 102, choice: 'Sim' }],
    }), response as unknown as VercelResponse);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(hasSubmissionInsert()).toBe(false);
  });
});
