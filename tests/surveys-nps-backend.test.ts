import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSql = vi.fn();
const mockAuthenticate = vi.fn();
const mockSendPush = vi.fn();

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (response: MockResponse, status: number, message: string) => response.status(status).json({ error: message }),
  CAN_MANAGE_EMPLOYEES: ['super_admin', 'admin', 'rh', 'adm'],
  sendPush: (...args: unknown[]) => mockSendPush(...args),
  JWT_SECRET: 'segredo-de-teste',
}));

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function makeResponse(): MockResponse {
  const response = {} as MockResponse;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  response.end = vi.fn().mockReturnValue(response);
  return response;
}

function makeRequest(
  method: string,
  query: Record<string, unknown>,
  body: unknown = {},
  headers: Record<string, string> = {},
): VercelRequest {
  return { method, query, body, headers } as unknown as VercelRequest;
}

const npsQuestion = { id: 101, position: 1, question: 'Você recomendaria?', type: 'nps', options: null, required: true };
const employeeSurvey = { id: 12, expires_at: null, question: 'Você recomendaria?', type: 'nps', options: null, audience: 'employees' };
const customerSurvey = { ...employeeSurvey, audience: 'customers' };

function publicResponseRequest(
  body: unknown,
  headers: Record<string, string> = {},
): VercelRequest {
  return makeRequest('POST', { id: '12', respond: 'true' }, body, headers);
}

function hasQuery(fragment: string): boolean {
  return mockSql.mock.calls.some((call) => String(call[0]).includes(fragment));
}

describe('NPS no servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 7, company_id: 10, role: 'rh' });
  });

  it('calcula as bordas 6/7 e 8/9 e não transforma ausência de respostas em zero', async () => {
    const { calculateNps } = await import('../api/surveys/index');

    expect(calculateNps([6, 7, 8, 9])).toEqual({
      promoters: 1,
      passives: 2,
      detractors: 1,
      nps: 0,
      poucas_respostas: true,
    });
    expect(calculateNps([])).toEqual({
      promoters: 0,
      passives: 0,
      detractors: 0,
      nps: null,
      poucas_respostas: true,
    });
    expect(calculateNps([9, 10, 9, 8, 7, 6, 0, 5, 4, 3])).toMatchObject({ nps: -20, poucas_respostas: false });
  });

  for (const invalidScore of [-1, 11, 7.5, '7'] as const) {
    it(`rejeita score NPS inválido (${String(invalidScore)}) sem gravar`, async () => {
      mockSql.mockResolvedValueOnce([customerSurvey]).mockResolvedValueOnce([npsQuestion]);
      const { default: handler } = await import('../api/surveys/index');
      const response = makeResponse();

      await handler(publicResponseRequest({ answers: [{ question_id: 101, score: invalidScore }] }), response as unknown as VercelResponse);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(hasQuery('INSERT INTO survey_submissions')).toBe(false);
    });
  }

  it('ignora contato sem consentimento e nunca inclui os dados pessoais no insert', async () => {
    mockSql.mockResolvedValueOnce([customerSurvey]).mockResolvedValueOnce([npsQuestion]).mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(publicResponseRequest({
      answers: [{ question_id: 101, score: 9 }],
      contact: { name: 'Pessoa Privada', phone: '+55 11 99999-9999', email: 'privado@example.test', consent: false },
    }), response as unknown as VercelResponse);

    const insertCall = mockSql.mock.calls.find((call) => String(call[0]).includes('INSERT INTO survey_submissions'));
    expect(insertCall?.flat()).not.toContain('Pessoa Privada');
    expect(insertCall?.flat()).not.toContain('+55 11 99999-9999');
    expect(insertCall?.flat()).not.toContain('privado@example.test');
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('campanha de clientes não gera notificação nem push interno', async () => {
    mockSql.mockResolvedValue([{ id: 12 }]);
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(makeRequest('POST', {}, {
      title: 'Satisfação',
      audience: 'customers',
      questions: [{ question: 'Você recomendaria?', type: 'nps', required: true }],
    }, { authorization: 'Bearer token' }), response as unknown as VercelResponse);

    expect(hasQuery('INSERT INTO notifications')).toBe(false);
    expect(mockSendPush).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('lista employees por padrão e aceita customers apenas quando solicitado', async () => {
    mockSql.mockResolvedValue([]);
    const { default: handler } = await import('../api/surveys/index');

    await handler(makeRequest('GET', {}, {}, { authorization: 'Bearer token' }), makeResponse() as unknown as VercelResponse);
    expect(mockSql.mock.calls[0].flat()).toContain('employees');

    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 7, company_id: 10, role: 'rh' });
    mockSql.mockResolvedValue([]);
    await handler(makeRequest('GET', { audience: 'customers' }, {}, { authorization: 'Bearer token' }), makeResponse() as unknown as VercelResponse);
    expect(mockSql.mock.calls[0].flat()).toContain('customers');
  });

  it('retorna NPS, contatos e filtra o resultado por company_id', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 12, audience: 'customers' }])
      .mockResolvedValueOnce([npsQuestion])
      .mockResolvedValueOnce([{ total: 4 }])
      .mockResolvedValueOnce([
        { question_id: 101, score: 6, choice: null, text: null },
        { question_id: 101, score: 7, choice: null, text: null },
        { question_id: 101, score: 8, choice: null, text: null },
        { question_id: 101, score: 9, choice: null, text: null },
      ])
      .mockResolvedValueOnce([{ submission_id: 50, name: 'Contato', phone: null, email: 'c@example.test', score: 6, comment: null, submitted_at: '2026-10-01', contacted_at: null }]);
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(makeRequest('GET', { id: '12', results: 'true' }, {}, { authorization: 'Bearer token' }), response as unknown as VercelResponse);

    const body = response.json.mock.calls[0]?.[0] as { questions: Array<{ nps: number | null; promoters: number; passives: number; detractors: number }>; contacts: Array<{ submission_id: number }> };
    expect(body.questions[0]).toMatchObject({ nps: 0, promoters: 1, passives: 2, detractors: 1 });
    expect(body.contacts).toEqual([expect.objectContaining({ submission_id: 50 })]);
    const contactsQuery = mockSql.mock.calls.find((call) => String(call[0]).includes('contact_consent IS TRUE'));
    expect(String(contactsQuery?.[0])).toContain('ps.company_id');
    expect(contactsQuery?.flat()).toContain(10);
  });

  it('marca contato somente dentro da empresa da pesquisa', async () => {
    mockSql.mockResolvedValueOnce([{ contact_resolved_at: '2026-10-01T10:00:00.000Z' }]);
    const { default: handler } = await import('../api/surveys/index');
    const response = makeResponse();

    await handler(makeRequest('PATCH', { id: '12', contact: '50' }, { contacted: true }, { authorization: 'Bearer token' }), response as unknown as VercelResponse);

    const update = mockSql.mock.calls[0];
    expect(String(update[0])).toContain('ps.company_id');
    expect(update.flat()).toContain(10);
    expect(response.json).toHaveBeenCalledWith({ contacted_at: '2026-10-01T10:00:00.000Z' });
  });

  it('permite a centésima resposta de employees do IP e barra a centésima primeira', async () => {
    mockSql
      .mockResolvedValueOnce([employeeSurvey])
      .mockResolvedValueOnce([npsQuestion])
      .mockResolvedValueOnce([{ total: 99 }])
      .mockResolvedValueOnce([]);
    const { default: handler } = await import('../api/surveys/index');
    const allowed = makeResponse();

    await handler(publicResponseRequest({ answers: [{ question_id: 101, score: 9 }] }, { 'x-real-ip': '203.0.113.8' }), allowed as unknown as VercelResponse);
    expect(allowed.status).toHaveBeenCalledWith(201);
    const insert = mockSql.mock.calls.find((call) => String(call[0]).includes('INSERT INTO survey_submissions'));
    expect(insert?.flat()).not.toContain('203.0.113.8');

    vi.clearAllMocks();
    mockSql
      .mockResolvedValueOnce([employeeSurvey])
      .mockResolvedValueOnce([npsQuestion])
      .mockResolvedValueOnce([{ total: 100 }]);
    const blocked = makeResponse();
    await handler(publicResponseRequest({ answers: [{ question_id: 101, score: 9 }] }, { 'x-real-ip': '203.0.113.8' }), blocked as unknown as VercelResponse);
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(hasQuery('INSERT INTO survey_submissions')).toBe(false);
  });

  it('barra a sexta resposta customers pelo mesmo IP e ignora x-forwarded-for forjado', async () => {
    mockSql
      .mockResolvedValueOnce([customerSurvey])
      .mockResolvedValueOnce([npsQuestion])
      .mockResolvedValueOnce([{ total: 5 }]);
    const { default: handler } = await import('../api/surveys/index');
    const blocked = makeResponse();

    await handler(publicResponseRequest({ answers: [{ question_id: 101, score: 9 }] }, { 'x-vercel-forwarded-for': '198.51.100.3' }), blocked as unknown as VercelResponse);
    expect(blocked.status).toHaveBeenCalledWith(429);

    vi.clearAllMocks();
    mockSql.mockResolvedValueOnce([customerSurvey]).mockResolvedValueOnce([npsQuestion]).mockResolvedValueOnce([]);
    const ignored = makeResponse();
    await handler(publicResponseRequest({ answers: [{ question_id: 101, score: 9 }] }, { 'x-forwarded-for': '198.51.100.3' }), ignored as unknown as VercelResponse);
    expect(ignored.status).toHaveBeenCalledWith(201);
    expect(mockSql).toHaveBeenCalledTimes(3);
  });
});
