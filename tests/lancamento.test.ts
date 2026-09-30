// tests/lancamento.test.ts
import { describe, expect, it } from 'vitest';
import {
  ATALHOS_HORAS_FOLGA,
  EntradaLancamento,
  SaldoColaborador,
  descreverLancamento,
  diaAnterior,
  entradaInicial,
  faltamHorasNaFolga,
  formatarHoras,
  montarLancamento,
  parseHoras,
  previaBancoHoras,
  previaFerias,
  usaQuanto,
} from '../helpers/lancamento';

const HOJE = '2026-09-30';
const SALDO: SaldoColaborador = { vacation_days: 20, folga_hours: 10 };

function entrada(parcial: Partial<EntradaLancamento>): EntradaLancamento {
  return { ...entradaInicial(), ...parcial };
}

describe('utilitários', () => {
  it('diaAnterior cruza mês, ano e ano bissexto', () => {
    expect(diaAnterior('2026-09-30')).toBe('2026-09-29');
    expect(diaAnterior('2026-10-01')).toBe('2026-09-30');
    expect(diaAnterior('2026-01-01')).toBe('2025-12-31');
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29');
  });

  it('parseHoras aceita vírgula e rejeita vazio, zero, negativo e texto', () => {
    expect(parseHoras('2,5')).toBe(2.5);
    expect(parseHoras(' 3 ')).toBe(3);
    for (const ruim of ['', '0', '-1', 'abc', '1,2,3']) expect(parseHoras(ruim)).toBeNull();
  });

  it('formatarHoras sem zeros à toa', () => {
    expect(formatarHoras(10)).toBe('10h');
    expect(formatarHoras(2.5)).toBe('2,5h');
    expect(formatarHoras(0.1 + 0.2)).toBe('0,3h');
  });
});

describe('Faltou', () => {
  it('dia inteiro hoje: createAbsence type falta, sem horas', () => {
    const r = montarLancamento(entrada({ tipo: 'faltou' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { via: 'ausencia', dados: { employee_id: 7, type: 'falta', start_date: HOJE, end_date: HOJE } } });
    if (r.ok && r.payload.via === 'ausencia') expect(r.payload.dados.hours).toBeUndefined();
  });

  it('ontem + algumas horas', () => {
    const r = montarLancamento(entrada({ tipo: 'faltou', atalhoData: 'ontem', quanto: 'algumas_horas', horas: '3' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { dados: { type: 'falta', start_date: '2026-09-29', end_date: '2026-09-29', hours: 3 } } });
  });

  it('não desconta saldo (sem prévia) e ignora saldo de folga', () => {
    const r = montarLancamento(entrada({ tipo: 'faltou', quanto: 'algumas_horas', horas: '50' }), 7, 'Ana', SALDO, HOJE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.previa).toBeNull();
  });

  it('"Outro dia" exige data válida; "só algumas horas" exige horas', () => {
    expect(montarLancamento(entrada({ tipo: 'faltou', atalhoData: 'outro', outroDia: '' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    expect(montarLancamento(entrada({ tipo: 'faltou', atalhoData: 'outro', outroDia: '31/02/2026' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    const ok = montarLancamento(entrada({ tipo: 'faltou', atalhoData: 'outro', outroDia: '15/09/2026' }), 7, 'Ana', SALDO, HOJE);
    expect(ok).toMatchObject({ ok: true, payload: { dados: { start_date: '2026-09-15' } } });
    expect(montarLancamento(entrada({ tipo: 'faltou', quanto: 'algumas_horas', horas: '' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
  });

  it('exige colaborador', () => {
    expect(montarLancamento(entrada({}), 0, '', SALDO, HOJE)).toMatchObject({ ok: false });
  });
});

describe('Folga', () => {
  it('com horas: type folga com hours e prévia 10h → 8h', () => {
    const r = montarLancamento(entrada({ tipo: 'folga', quanto: 'algumas_horas', horas: '2' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { via: 'ausencia', dados: { type: 'folga', hours: 2, start_date: HOJE, end_date: HOJE } }, previa: { antes: 10, depois: 8 } });
  });

  it('horas maiores que o saldo bloqueiam com mensagem clara', () => {
    const r = montarLancamento(entrada({ tipo: 'folga', quanto: 'algumas_horas', horas: '11' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.erro).toContain('Ana tem só 10h no banco de horas');
  });

  it('horas iguais ao saldo passam (zera o banco)', () => {
    const r = montarLancamento(entrada({ tipo: 'folga', quanto: 'algumas_horas', horas: '10' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, previa: { antes: 10, depois: 0 } });
  });

  it('sem horas: inválida e Salvar bloqueado (não existe folga de dia inteiro sem horas)', () => {
    for (const horas of ['', '0', '-2', 'abc']) {
      const e = entrada({ tipo: 'folga', horas });
      expect(faltamHorasNaFolga(e)).toBe(true);
      expect(montarLancamento(e, 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    }
    expect(faltamHorasNaFolga(entrada({ tipo: 'folga', horas: '2' }))).toBe(false);
    expect(faltamHorasNaFolga(entrada({ tipo: 'faltou' }))).toBe(false);
  });

  it('com horas o payload SEMPRE leva hours, mesmo com "quanto" em dia inteiro (ignorado na folga)', () => {
    const r = montarLancamento(entrada({ tipo: 'folga', quanto: 'dia_inteiro', horas: '4' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { dados: { type: 'folga', hours: 4 } }, previa: { antes: 10, depois: 6 } });
  });

  it('só Faltou escolhe dia inteiro/algumas horas', () => {
    expect(usaQuanto('faltou')).toBe(true);
    expect(usaQuanto('folga')).toBe(false);
    expect(ATALHOS_HORAS_FOLGA).toEqual([2, 4, 8]);
  });

  it('saldo zero bloqueia qualquer folga', () => {
    const r = montarLancamento(entrada({ tipo: 'folga', horas: '1' }), 7, 'Ana', { vacation_days: 20, folga_hours: 0 }, HOJE);
    expect(r).toMatchObject({ ok: false });
  });

  it('prévia só aparece com horas válidas', () => {
    expect(previaBancoHoras(entrada({ tipo: 'folga', quanto: 'algumas_horas', horas: '' }), SALDO)).toBeNull();
    expect(previaBancoHoras(entrada({ tipo: 'faltou' }), SALDO)).toBeNull();
  });
});

describe('Hora extra', () => {
  it('usa folga_hours_delta (mesmo payload do crédito atual) e prévia 10h → 12h', () => {
    const r = montarLancamento(entrada({ tipo: 'hora_extra', horas: '2' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toEqual({ ok: true, payload: { via: 'banco_horas', employee_id: 7, folga_hours_delta: 2 }, previa: { rotulo: 'Banco de horas', antes: 10, depois: 12, unidade: 'h' } });
  });

  it('exige horas > 0', () => {
    expect(montarLancamento(entrada({ tipo: 'hora_extra', horas: '' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    expect(montarLancamento(entrada({ tipo: 'hora_extra', horas: '0' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
  });
});

describe('Férias e Licença', () => {
  it('férias: período e prévia de dias (20 → 15 em 5 dias)', () => {
    const r = montarLancamento(entrada({ tipo: 'ferias', inicio: '01/10/2026', fim: '05/10/2026' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { via: 'ausencia', dados: { type: 'ferias', start_date: '2026-10-01', end_date: '2026-10-05' } }, previa: { antes: 20, depois: 15, unidade: 'dias' } });
  });

  it('férias acima do saldo bloqueiam', () => {
    const r = montarLancamento(entrada({ tipo: 'ferias', inicio: '01/10/2026', fim: '31/10/2026' }), 7, 'Ana', SALDO, HOJE);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.erro).toContain('20 dias de férias disponíveis');
  });

  it('período incompleto, inválido ou invertido é recusado', () => {
    expect(montarLancamento(entrada({ tipo: 'ferias', inicio: '01/10/2026', fim: '' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    expect(montarLancamento(entrada({ tipo: 'ferias', inicio: '10/10/2026', fim: '05/10/2026' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
    expect(montarLancamento(entrada({ tipo: 'licenca', inicio: '99/99/2026', fim: '05/10/2026' }), 7, 'Ana', SALDO, HOJE)).toMatchObject({ ok: false });
  });

  it('licença usa o subtipo escolhido, não consome férias e leva a observação', () => {
    const r = montarLancamento(entrada({ tipo: 'licenca', licenca: 'licenca_maternidade', inicio: '01/10/2026', fim: '28/02/2027', observacao: ' parto ' }), 7, 'Ana', { vacation_days: 0, folga_hours: 0 }, HOJE);
    expect(r).toMatchObject({ ok: true, payload: { dados: { type: 'licenca_maternidade', reason: 'parto' } }, previa: null });
  });

  it('previaFerias sem período válido mostra só o saldo', () => {
    expect(previaFerias(entrada({ tipo: 'ferias' }), SALDO)).toMatchObject({ antes: 20, depois: 20, dias: null });
  });
});

describe('descreverLancamento', () => {
  it('diz o que foi lançado e para quem, com saldo antes → depois', () => {
    const folga = entrada({ tipo: 'folga', quanto: 'algumas_horas', horas: '2' });
    const r = montarLancamento(folga, 7, 'Ana', SALDO, HOJE);
    if (!r.ok) throw new Error('esperava ok');
    expect(descreverLancamento(r.payload, folga, 'Ana', r.previa)).toBe('Folga de 2h lançada para Ana em 30/09. Banco de horas: 10h → 8h.');

    const extra = entrada({ tipo: 'hora_extra', horas: '2' });
    const e = montarLancamento(extra, 7, 'Ana', SALDO, HOJE);
    if (!e.ok) throw new Error('esperava ok');
    expect(descreverLancamento(e.payload, extra, 'Ana', e.previa)).toBe('2h de hora extra lançadas para Ana. Banco de horas: 10h → 12h.');

    const falta = entrada({ tipo: 'faltou' });
    const f = montarLancamento(falta, 7, 'Ana', SALDO, HOJE);
    if (!f.ok) throw new Error('esperava ok');
    expect(descreverLancamento(f.payload, falta, 'Ana', f.previa)).toBe('Falta lançada para Ana em 30/09.');
  });
});
