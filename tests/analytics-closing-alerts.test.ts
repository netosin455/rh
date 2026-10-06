import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql, mockAuthenticate } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockAuthenticate: vi.fn(),
}));

vi.mock('../api/_lib', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
  cors: vi.fn(),
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  err: (res: MockResponse, status: number, message: string) => res.status(status).json({ error: message }),
  IS_ADMIN: ['super_admin', 'admin'],
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = { completions: { create: vi.fn() } };
  },
}));

import handler, {
  buildExperienceAlert,
  buildHighBankHoursAlert,
  buildRecentAbsencesAlert,
} from '../api/analytics/index';

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

function response(): MockResponse {
  const result = {} as MockResponse;
  result.status = vi.fn().mockReturnValue(result);
  result.json = vi.fn().mockReturnValue(result);
  result.end = vi.fn().mockReturnValue(result);
  return result;
}

function closingRequest(month: string): VercelRequest {
  return {
    method: 'GET',
    query: { view: 'fechamento', month },
    headers: { authorization: 'Bearer teste' },
  } as unknown as VercelRequest;
}

describe('GET /api/analytics?view=fechamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'rh' });
  });

  it('retorna a equipe inteira, totais e valores numéricos do fechamento isolado por empresa', async () => {
    mockSql.mockResolvedValueOnce([
      {
        employee_id: 2, name: 'Ana', department_name: 'Trabalhista', role_title: 'Advogada',
        faltas_dias: '2', faltas_horas: '3.5', folgas_horas: '8', ferias_dias: '4',
        licencas_dias: '1', banco_horas_saldo: '40',
      },
      {
        employee_id: 3, name: 'Bia', department_name: 'Sem departamento', role_title: 'Assistente',
        faltas_dias: 0, faltas_horas: 0, folgas_horas: 0, ferias_dias: 0,
        licencas_dias: 0, banco_horas_saldo: 12,
      },
    ]);

    const res = response();
    await handler(closingRequest('2026-02'), res as unknown as VercelResponse);

    const body = res.json.mock.calls[0]?.[0] as {
      month: string;
      saldo_referencia: string;
      linhas: Array<{ name: string; faltas_horas: number }>;
      totais: Record<string, number>;
    };
    expect(body.month).toBe('2026-02');
    expect(body.saldo_referencia).toBe('atual');
    expect(body.linhas).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Ana', faltas_horas: 3.5, ferias_dias: 4 }),
      expect.objectContaining({ name: 'Bia', faltas_dias: 0, banco_horas_saldo: 12 }),
    ]));
    expect(body.totais).toEqual({
      faltas_dias: 2, faltas_horas: 3.5, folgas_horas: 8,
      ferias_dias: 4, licencas_dias: 1, banco_horas_saldo: 52,
    });

    const closingSql = String(mockSql.mock.calls[0][0]);
    expect(closingSql).toContain("a.status = 'aprovado'");
    expect(closingSql).toContain('LEAST(a.end_date, p.fim) - GREATEST(a.start_date, p.inicio) + 1');
    expect(closingSql).toContain("a.type = 'falta' AND a.hours IS NULL");
    expect(closingSql).toContain("a.type = 'falta' AND a.hours IS NOT NULL");
    expect(closingSql).toContain("a.type = 'folga' AND a.hours IS NOT NULL");
    expect(closingSql).toContain("'licenca_medica', 'licenca_maternidade', 'licenca_paternidade'");
    expect(closingSql).toContain('a.company_id =');
    expect(mockSql.mock.calls[0].flat()).toContain(10);
  });

  it('rejeita mês inválido antes de consultar o banco', async () => {
    const res = response();
    await handler(closingRequest('2026-13'), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('restringe o fechamento à mesma permissão administrativa de analytics', async () => {
    mockAuthenticate.mockReturnValue({ sub: 1, company_id: 10, role: 'colaborador' });
    const res = response();
    await handler(closingRequest('2026-02'), res as unknown as VercelResponse);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockSql).not.toHaveBeenCalled();
  });
});

describe('alertas novos de analytics', () => {
  it('inclui experiência nos limites de hoje e de dez dias, mas exclui onze dias', () => {
    const alert = buildExperienceAlert([
      { id: 1, name: 'Ana', marco: 45, dias_restantes: 0 },
      { id: 2, name: 'Bia', marco: 90, dias_restantes: 10 },
      { id: 3, name: 'Cris', marco: 90, dias_restantes: 11 },
    ]);

    expect(alert).toMatchObject({ type: 'experiencia_acabando', severity: 'alta', route: 'colaboradores', icon: 'hourglass-outline' });
    expect(alert?.title).toContain('2 contratos');
    expect(alert?.description).toContain('Ana (45 dias em 0 dias)');
    expect(alert?.description).toContain('Bia (90 dias em 10 dias)');
    expect(alert?.description).not.toContain('Cris');
  });

  it('considera banco de horas a partir de 40 e faltas a partir de duas ocorrências', () => {
    expect(buildHighBankHoursAlert([
      { id: 1, name: 'Ana', folga_hours: 39.99 },
      { id: 2, name: 'Bia', folga_hours: 40 },
    ])).toMatchObject({ type: 'banco_horas_alto', route: 'colaborador/2', icon: 'time-outline' });

    expect(buildRecentAbsencesAlert([
      { id: 1, name: 'Ana', faltas: 1 },
      { id: 2, name: 'Bia', faltas: 2 },
    ])).toMatchObject({ type: 'faltas_recentes', route: 'colaborador/2', icon: 'alert-circle-outline' });
  });

  it('não cria alertas quando nenhuma pessoa satisfaz os limiares', () => {
    expect(buildExperienceAlert([])).toBeNull();
    expect(buildHighBankHoursAlert([])).toBeNull();
    expect(buildRecentAbsencesAlert([])).toBeNull();
  });
});
