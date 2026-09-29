import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSql } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  return { mockSql: vi.fn() };
});

vi.mock('@neondatabase/serverless', () => ({
  neon: () => (...args: unknown[]) => mockSql(...args),
}));

import { createAbsenceRecord, resolveAbsenceApproval } from '../api/_lib';

const employeeCtx = { sub: 1, company_id: 10, role: 'colaborador', name: 'Ana', email: 'ana@empresa.com' };
const rhCtx = { sub: 2, company_id: 10, role: 'rh', name: 'RH', email: 'rh@empresa.com' };

describe('regras críticas de ausências', () => {
  beforeEach(() => vi.clearAllMocks());

  it('impede colaborador de solicitar ausência para cadastro de outra pessoa', async () => {
    mockSql.mockResolvedValueOnce([{ id: 9, name: 'Bruno', user_id: 3, vacation_days: 30, folga_hours: 8 }]);

    const result = await createAbsenceRecord(employeeCtx, {
      employee_id: 9,
      type: 'ferias',
      start_date: '2026-08-01',
      end_date: '2026-08-02',
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('impede reaprovar solicitação já processada e descontar saldo novamente', async () => {
    mockSql.mockResolvedValueOnce([{
      type: 'ferias', days_count: 5, hours: null, status: 'aprovado',
      employee_id: 9, vacation_days: 25, folga_hours: 8,
    }]);

    const result = await resolveAbsenceApproval(rhCtx, 40, true);

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('revalida saldo no momento da aprovação', async () => {
    mockSql.mockResolvedValueOnce([{
      type: 'ferias', days_count: 5, hours: null, status: 'pendente',
      employee_id: 9, vacation_days: 2, folga_hours: 8,
    }]);

    const result = await resolveAbsenceApproval(rhCtx, 40, true);

    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('debita férias e cria lançamento autoaprovado na mesma instrução atômica', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 9, name: 'Ana', user_id: null, vacation_days: 30, folga_hours: 8 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 41, status: 'aprovado' }]);

    const result = await createAbsenceRecord(rhCtx, {
      employee_id: 9,
      type: 'ferias',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
    });

    expect(result).toMatchObject({ ok: true, status: 201 });
    const mutation = String(mockSql.mock.calls[2][0]);
    expect(mutation).toContain('WITH debited');
    expect(mutation).toContain('vacation_days = vacation_days -');
    expect(mutation).toContain('INSERT INTO absences');
  });

  it('debita saldo e aprova solicitação pendente na mesma instrução atômica', async () => {
    mockSql
      .mockResolvedValueOnce([{
        type: 'ferias', days_count: 5, hours: null, status: 'pendente',
        employee_id: 9, vacation_days: 10, folga_hours: 8,
      }])
      .mockResolvedValueOnce([{ id: 40, employee_user_id: null, status: 'aprovado' }]);

    const result = await resolveAbsenceApproval(rhCtx, 40, true);

    expect(result).toMatchObject({ ok: true, status: 200 });
    const mutation = String(mockSql.mock.calls[1][0]);
    expect(mutation).toContain('WITH debited');
    expect(mutation).toContain("status = 'pendente'");
  });

  it.each([
    [true, 'aprovar'],
    [false, 'recusar'],
  ])('não cria notificação global ao %s ausência de colaborador sem login', async (approved) => {
    mockSql
      .mockResolvedValueOnce([{
        type: 'ferias', days_count: 5, hours: null, status: 'pendente',
        employee_id: 9, vacation_days: 10, folga_hours: 8,
      }])
      .mockResolvedValueOnce([{
        id: 40,
        employee_user_id: null,
        status: approved ? 'aprovado' : 'recusado',
      }]);

    const result = await resolveAbsenceApproval(rhCtx, 40, approved);

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(mockSql.mock.calls.some(([query]) => String(query).includes('INSERT INTO notifications'))).toBe(false);
  });
});
