// tests/risco.test.ts
// Os limiares espelham banco/migrations/006_analytics_engagement.sql: estes testes travam as bordas.
import { describe, expect, it } from 'vitest';
import {
  LIMIAR_DIAS_EMPRESA_ALTO,
  LIMIAR_FALTAS_ALTO,
  LIMIAR_FALTAS_MEDIO,
  LIMIAR_PULSO_ALTO,
  LIMIAR_PULSO_MEDIO,
  classificarRisco,
  formatarPulso,
  lerFiltroRisco,
  motivosDeRisco,
  motivosParaNivel,
  rotaAnalytics,
  rotaDoAlerta,
  tituloDaLista,
} from '../helpers/risco';

/** Pessoa "tranquila": longe de todas as bordas. */
const BASE = { days_in_company: 400, absences_90d: 0, avg_pulse_score: 4.5 as number | string | null | undefined };

describe('limiares (espelham a migration 006)', () => {
  it('valores', () => {
    expect([LIMIAR_FALTAS_ALTO, LIMIAR_DIAS_EMPRESA_ALTO, LIMIAR_PULSO_ALTO, LIMIAR_FALTAS_MEDIO, LIMIAR_PULSO_MEDIO]).toEqual([4, 90, 2.5, 2, 3.5]);
  });
});

describe('classificarRisco: bordas', () => {
  it('faltas: 1 baixo, 2 médio, 3 médio, 4 alto', () => {
    expect([1, 2, 3, 4].map((n) => classificarRisco({ ...BASE, absences_90d: n }))).toEqual(['baixo', 'medio', 'medio', 'alto']);
  });

  it('dias na empresa: 89 alto, 90 não é alto', () => {
    expect(classificarRisco({ ...BASE, days_in_company: 89 })).toBe('alto');
    expect(classificarRisco({ ...BASE, days_in_company: 90 })).toBe('baixo');
    expect(classificarRisco({ ...BASE, days_in_company: 0 })).toBe('alto');
  });

  it('pulso: 2,49 alto; 2,5 médio; 3,49 médio; 3,5 baixo', () => {
    expect(classificarRisco({ ...BASE, avg_pulse_score: 2.49 })).toBe('alto');
    expect(classificarRisco({ ...BASE, avg_pulse_score: 2.5 })).toBe('medio');
    expect(classificarRisco({ ...BASE, avg_pulse_score: 3.49 })).toBe('medio');
    expect(classificarRisco({ ...BASE, avg_pulse_score: 3.5 })).toBe('baixo');
  });

  it('sem pulso (null/undefined) não conta como sinal', () => {
    expect(classificarRisco({ ...BASE, avg_pulse_score: null })).toBe('baixo');
    expect(classificarRisco({ ...BASE, avg_pulse_score: undefined })).toBe('baixo');
    expect(classificarRisco({ days_in_company: 400, absences_90d: 0 })).toBe('baixo');
  });

  it('pulso vindo como texto numérico do Postgres também vale; lixo é ignorado', () => {
    expect(classificarRisco({ ...BASE, avg_pulse_score: '2.40' })).toBe('alto');
    expect(classificarRisco({ ...BASE, avg_pulse_score: 'abc' })).toBe('baixo');
    expect(classificarRisco({ ...BASE, avg_pulse_score: '' })).toBe('baixo');
  });

  it('o pior sinal decide: alto ganha de médio', () => {
    expect(classificarRisco({ days_in_company: 30, absences_90d: 2, avg_pulse_score: 3.0 })).toBe('alto');
    expect(classificarRisco({ days_in_company: 400, absences_90d: 2, avg_pulse_score: 2.0 })).toBe('alto');
  });
});

describe('motivosDeRisco', () => {
  it('baixo: sem sinais de atenção', () => {
    expect(motivosDeRisco(BASE)).toEqual(['Sem sinais de atenção']);
  });

  it('lista TODOS os motivos que se aplicam', () => {
    expect(motivosDeRisco({ days_in_company: 45, absences_90d: 3, avg_pulse_score: 3.2 })).toEqual(['3 faltas em 90 dias', 'Há 45 dias na empresa', 'Pulso 3,2/5']);
  });

  it('singular e plural', () => {
    expect(motivosDeRisco({ ...BASE, absences_90d: 2 })).toEqual(['2 faltas em 90 dias']);
    expect(motivosDeRisco({ ...BASE, days_in_company: 1 })).toEqual(['Há 1 dia na empresa']);
    expect(motivosDeRisco({ ...BASE, days_in_company: 0 })).toEqual(['Entrou hoje']);
  });

  it('1 falta sozinha não é motivo (abaixo do limiar médio)', () => {
    expect(motivosDeRisco({ ...BASE, absences_90d: 1 })).toEqual(['Sem sinais de atenção']);
  });

  it('pulso sem dado não vira motivo', () => {
    expect(motivosDeRisco({ ...BASE, days_in_company: 45, avg_pulse_score: null })).toEqual(['Há 45 dias na empresa']);
  });

  it('pulso na borda aparece com o limiar certo (3,5 não é motivo; 3,49 é)', () => {
    expect(motivosDeRisco({ ...BASE, avg_pulse_score: 3.5 })).toEqual(['Sem sinais de atenção']);
    expect(motivosDeRisco({ ...BASE, avg_pulse_score: 3.49 })[0]).toBe('Pulso 3,49/5');
  });
});

describe('formatarPulso', () => {
  it('1 casa normalmente; 2 casas quando arredondar esconderia o motivo', () => {
    expect(formatarPulso(3.2)).toBe('3,2');
    expect(formatarPulso(2.49)).toBe('2,49');
    expect(formatarPulso(3.49)).toBe('3,49');
    expect(formatarPulso(2.5)).toBe('2,5');
    expect(formatarPulso(1.84)).toBe('1,8');
  });
});

describe('motivosParaNivel (nível vem do servidor)', () => {
  it('não diz "sem sinais" de quem o servidor colocou em risco', () => {
    expect(motivosParaNivel(BASE, 'medio')[0]).toContain('definido pelo servidor');
    expect(motivosParaNivel(BASE, 'baixo')).toEqual(['Sem sinais de atenção']);
    expect(motivosParaNivel({ ...BASE, absences_90d: 2 }, 'medio')).toEqual(['2 faltas em 90 dias']);
  });
});

describe('filtro na URL', () => {
  it('aceita alto, medio e baixo; qualquer outra coisa é ignorada', () => {
    expect(lerFiltroRisco('alto')).toBe('alto');
    expect(lerFiltroRisco('medio')).toBe('medio');
    expect(lerFiltroRisco('baixo')).toBe('baixo');
    for (const ruim of ['', 'ALTO', 'médio', 'todos', '<script>', undefined]) expect(lerFiltroRisco(ruim), String(ruim)).toBeNull();
  });

  it('parâmetro repetido (array) usa o primeiro', () => {
    expect(lerFiltroRisco(['medio', 'alto'])).toBe('medio');
    expect(lerFiltroRisco([])).toBeNull();
  });

  it('rota de Analytics', () => {
    expect(rotaAnalytics()).toBe('/analytics');
    expect(rotaAnalytics('medio')).toBe('/analytics?risco=medio');
  });

  it('título da lista', () => {
    expect(tituloDaLista('medio', 5)).toBe('Risco médio · 5 pessoas');
    expect(tituloDaLista('alto', 1)).toBe('Risco alto · 1 pessoa');
  });
});

describe('rotaDoAlerta (Dashboard)', () => {
  it('risco de saída vai para a lista filtrada; os outros seguem a rota da API', () => {
    expect(rotaDoAlerta({ type: 'turnover_risk', route: 'analytics' })).toBe('/analytics?risco=alto');
    expect(rotaDoAlerta({ type: 'absenteeism', route: 'analytics' })).toBe('/analytics');
    expect(rotaDoAlerta({ type: 'onboarding', route: 'onboarding' })).toBe('/onboarding');
  });
});
