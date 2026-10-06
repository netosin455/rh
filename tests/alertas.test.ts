// tests/alertas.test.ts — alertas do Dashboard: ícone, nível e rota com fallback
import { describe, expect, it } from 'vitest';
import { iconeDoAlerta, nivelDoAlerta } from '../helpers/alertas';
import { rotaDoAlerta } from '../helpers/risco';

const GLIFOS = { 'hourglass-outline': 1, 'time-outline': 1, 'alert-circle-outline': 1, 'people-outline': 1 };

describe('iconeDoAlerta', () => {
  it('usa o ícone da API quando ele existe', () => {
    expect(iconeDoAlerta({ type: 'banco_horas_alto', icon: 'time-outline' }, GLIFOS)).toBe('time-outline');
  });

  it('ícone inexistente ou vazio cai no ícone do tipo', () => {
    expect(iconeDoAlerta({ type: 'experiencia_acabando', icon: 'nao-existe' }, GLIFOS)).toBe('hourglass-outline');
    expect(iconeDoAlerta({ type: 'banco_horas_alto', icon: '' }, GLIFOS)).toBe('time-outline');
  });

  it('tipo desconhecido sem ícone válido cai no padrão', () => {
    expect(iconeDoAlerta({ type: 'tipo_novo' as never, icon: 'xx' }, GLIFOS)).toBe('alert-circle-outline');
  });
});

describe('nivelDoAlerta', () => {
  it('só "alta" é urgente', () => {
    expect(nivelDoAlerta({ severity: 'alta' })).toBe('urgent');
    expect(nivelDoAlerta({ severity: 'media' })).toBe('important');
    expect(nivelDoAlerta({ severity: 'qualquer' as never })).toBe('important');
  });
});

describe('rotaDoAlerta com os tipos novos e fallback', () => {
  it('rotas prontas da API', () => {
    expect(rotaDoAlerta({ type: 'experiencia_acabando', route: 'colaborador/7' })).toBe('/colaborador/7');
    expect(rotaDoAlerta({ type: 'banco_horas_alto', route: 'colaboradores' })).toBe('/colaboradores');
    expect(rotaDoAlerta({ type: 'faltas_recentes', route: '/colaborador/3' })).toBe('/colaborador/3');
  });

  it('não quebra o alerta de turnover_risk', () => {
    expect(rotaDoAlerta({ type: 'turnover_risk', route: 'analytics' })).toBe('/analytics?risco=alto');
  });

  it('rota ausente cai nas notificações', () => {
    expect(rotaDoAlerta({ type: 'tipo_novo' as never, route: undefined as never })).toBe('/notificacoes');
    expect(rotaDoAlerta({ type: 'faltas_recentes', route: '  ' })).toBe('/notificacoes');
  });
});
