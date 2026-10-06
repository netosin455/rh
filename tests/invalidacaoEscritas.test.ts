// tests/invalidacaoEscritas.test.ts — toda função de escrita invalida o que afeta (nenhuma tela esquece)
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../conexoes/http', () => ({
  apiFetch: vi.fn(),
  publicFetch: vi.fn(),
  extrairLista: (r: unknown) => (Array.isArray(r) ? r : (r as { data: unknown[] }).data),
  ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } },
}));

import { apiFetch, publicFetch } from '../conexoes/http';
import { approveAbsence, createAbsence, deleteAbsence, updateAbsence } from '../conexoes/ausencias';
import { createNotice, deleteNotice, pinNotice, updateNotice } from '../conexoes/avisos';
import { createEmployee, deleteEmployee, updateEmployee } from '../conexoes/colaboradores';
import { createEvent, deleteEvent, updateEvent } from '../conexoes/eventos';
import { acknowledgeFeedback, createFeedback, deleteFeedback, publishFeedback, revokeFeedback, updateFeedback } from '../conexoes/feedbacks';
import { createPayslip, deletePayslip } from '../conexoes/holerites';
import { marcarLida, marcarTodasLidas } from '../conexoes/notificacoes';
import { deleteOnboarding, markStep, startOnboarding } from '../conexoes/onboarding';
import { apagarContato, createSurvey, deleteSurvey, duplicarPesquisa, encerrarPesquisaAgora, marcarContatado, respondSurvey, updateSurvey } from '../conexoes/pesquisas';
import { createRecognition, deleteRecognition } from '../conexoes/reconhecimentos';
import { createUser, deleteUser, updateUser } from '../conexoes/usuarios';
import { gravarCache, lerCache, limpar } from '../helpers/cacheDados';
import { PREFIXOS_AFETADOS, RecursoEscrito } from '../helpers/invalidacaoCache';

/** Uma chave de exemplo para cada prefixo que o app usa (as mesmas de helpers/chavesCache.ts). */
const CHAVES = [
  'employees:todos', 'absences:todos', 'absences:status=pendente', 'absences:contagem:pendente', 'analytics:geral', 'analytics:alertas',
  'fechamento:2026-10', 'events:2026-10', 'notices', 'surveys:employees', 'surveys:customers', 'feedbacks', 'notifications:lista',
  'recognitions', 'onboarding:lista', 'users:lista', 'payslips:1', 'insights:ia',
];

function semear() { CHAVES.forEach((c) => gravarCache(c, 'velho')); }
const prefixoDe = (chave: string) => chave.split(':')[0];

beforeEach(() => {
  limpar();
  vi.mocked(apiFetch).mockReset().mockResolvedValue({ id: 1, questions: [], title: 'x', audience: 'employees' });
  vi.mocked(publicFetch).mockReset().mockResolvedValue({});
});

const ESCRITAS: [string, RecursoEscrito, () => Promise<unknown>][] = [
  ['createAbsence', 'absences', () => createAbsence({ employee_id: 1, type: 'falta', start_date: '2026-10-01', end_date: '2026-10-01' })],
  ['updateAbsence', 'absences', () => updateAbsence(1, { hours: 2 })],
  ['approveAbsence', 'absences', () => approveAbsence(1, true)],
  ['deleteAbsence', 'absences', () => deleteAbsence(1)],
  ['createEmployee', 'employees', () => createEmployee({ name: 'A', role_title: 'B', hire_date: '2026-01-01', status: 'ativo', vacation_days: 30, folga_hours: 0 })],
  ['updateEmployee', 'employees', () => updateEmployee(1, { folga_hours_delta: 2 })],
  ['deleteEmployee', 'employees', () => deleteEmployee(1)],
  ['createEvent', 'events', () => createEvent({ title: 'x', date: '2026-10-01', color: '#000', category: 'outro', is_all_day: true })],
  ['updateEvent', 'events', () => updateEvent('ev-1', { title: 'y' })],
  ['deleteEvent', 'events', () => deleteEvent('ev-1')],
  ['createNotice', 'notices', () => createNotice({ title: 'a', body: 'b', priority: 'normal', pinned: false })],
  ['updateNotice', 'notices', () => updateNotice(1, { title: 'c' })],
  ['pinNotice', 'notices', () => pinNotice(1, true)],
  ['deleteNotice', 'notices', () => deleteNotice(1)],
  ['createSurvey', 'surveys', () => createSurvey({ title: 'x', questions: [] })],
  ['updateSurvey', 'surveys', () => updateSurvey(1, { title: 'y' })],
  ['deleteSurvey', 'surveys', () => deleteSurvey(1)],
  ['duplicarPesquisa', 'surveys', () => duplicarPesquisa(1)],
  ['encerrarPesquisaAgora', 'surveys', () => encerrarPesquisaAgora(1, '2026-10-06')],
  ['marcarContatado', 'surveys', () => marcarContatado(1, 2)],
  ['apagarContato', 'surveys', () => apagarContato(1, 2)],
  ['respondSurvey (pública)', 'surveys', () => respondSurvey(1, { voter_token: 'v', answers: [] })],
  ['createFeedback', 'feedbacks', () => createFeedback({ employee_id: 1, title: 't', content: 'c' })],
  ['updateFeedback', 'feedbacks', () => updateFeedback(1, { employee_id: 1, title: 't', content: 'c' })],
  ['deleteFeedback', 'feedbacks', () => deleteFeedback(1)],
  ['publishFeedback', 'feedbacks', () => publishFeedback(1)],
  ['revokeFeedback', 'feedbacks', () => revokeFeedback(1)],
  ['acknowledgeFeedback (pública)', 'feedbacks', () => acknowledgeFeedback('t'.repeat(43), 'ok')],
  ['createRecognition', 'recognitions', () => createRecognition({ to_employee_id: 1, message: 'm', category: 'outro' })],
  ['deleteRecognition', 'recognitions', () => deleteRecognition(1)],
  ['marcarLida', 'notifications', () => marcarLida(1)],
  ['marcarTodasLidas', 'notifications', () => marcarTodasLidas()],
  ['startOnboarding', 'onboarding', () => startOnboarding(1)],
  ['markStep', 'onboarding', () => markStep(1, 0, true)],
  ['deleteOnboarding', 'onboarding', () => deleteOnboarding(1)],
  ['createUser', 'users', () => createUser({ name: 'n', email: 'e', username: 'u', password: 'p', role: 'rh' })],
  ['updateUser', 'users', () => updateUser(1, { name: 'n' })],
  ['deleteUser', 'users', () => deleteUser(1)],
  ['createPayslip', 'payslips', () => createPayslip({ employee_id: 1, month: '2026-10', file_url: 'u' })],
  ['deletePayslip', 'payslips', () => deletePayslip(1)],
];

describe.each(ESCRITAS)('%s', (_nome, recurso, escrever) => {
  const afetados = PREFIXOS_AFETADOS[recurso];

  it('depois da escrita, o dado afetado NÃO é mais servido do cache; o resto fica', async () => {
    semear();
    await escrever();
    for (const chave of CHAVES) {
      const velho = afetados.includes(prefixoDe(chave));
      expect(lerCache(chave) === undefined, `${chave} ${velho ? 'devia' : 'não devia'} ter sido invalidada`).toBe(velho);
    }
  });

  it('se a escrita FALHAR (ex.: timeout), invalida do mesmo jeito (o servidor pode ter gravado)', async () => {
    // duplicarPesquisa falha na LEITURA (getSurvey) antes de qualquer escrita: nada a invalidar.
    if (_nome === 'duplicarPesquisa') return;
    semear();
    vi.mocked(apiFetch).mockRejectedValue(new Error('timeout'));
    vi.mocked(publicFetch).mockRejectedValue(new Error('timeout'));
    await escrever().catch(() => undefined);
    for (const p of afetados) {
      for (const chave of CHAVES.filter((c) => prefixoDe(c) === p)) expect(lerCache(chave), chave).toBeUndefined();
    }
  });
});

describe('o mapa de invalidação protege o saldo e os números', () => {
  it('escrita em ausência invalida colaboradores (saldo de folga/férias), analytics (alertas) e fechamento', () => {
    expect(PREFIXOS_AFETADOS.absences).toEqual(expect.arrayContaining(['absences', 'employees', 'analytics', 'fechamento']));
  });

  it('escrita em colaborador invalida employees, analytics e fechamento', () => {
    expect(PREFIXOS_AFETADOS.employees).toEqual(expect.arrayContaining(['employees', 'analytics', 'fechamento']));
  });

  it('resumos de IA (insights) não são invalidados por escrita comum', () => {
    for (const lista of Object.values(PREFIXOS_AFETADOS)) expect(lista).not.toContain('insights');
  });
});
