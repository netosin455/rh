// tests/navegacao.test.ts
import { describe, it, expect } from 'vitest';
import { normalizarCaminho, resolverItemAtivo, ItemNavegavel } from '../helpers/navegacao';

const ITENS: ItemNavegavel[] = [
  { key: 'dashboard', href: '/(tabs)' },
  { key: 'equipe', href: '/(tabs)/colaboradores', subrotas: ['/colaborador'] },
  { key: 'onboarding', href: '/onboarding' },
  { key: 'pesquisas', href: '/pesquisas' },
  { key: 'feedbacks', href: '/feedbacks' },
  { key: 'ferias', href: '/(tabs)/ferias' },
];

describe('normalizarCaminho', () => {
  it('remove grupos, query e barra final', () => {
    expect(normalizarCaminho('/(tabs)')).toBe('/');
    expect(normalizarCaminho('/(tabs)/ferias/?a=1')).toBe('/ferias');
    expect(normalizarCaminho('')).toBe('/');
  });
});

describe('resolverItemAtivo', () => {
  it('marca o dashboard só na raiz', () => {
    expect(resolverItemAtivo('/', ITENS)).toBe('dashboard');
    expect(resolverItemAtivo('/ferias', ITENS)).toBe('ferias');
  });

  it('marca o item pai nas subrotas de detalhe', () => {
    expect(resolverItemAtivo('/colaborador/12', ITENS)).toBe('equipe');
    expect(resolverItemAtivo('/onboarding/3', ITENS)).toBe('onboarding');
    expect(resolverItemAtivo('/pesquisas/7', ITENS)).toBe('pesquisas');
    expect(resolverItemAtivo('/feedbacks/novo', ITENS)).toBe('feedbacks');
  });

  it('respeita a fronteira de segmento', () => {
    expect(resolverItemAtivo('/feedback/abc', ITENS)).toBeUndefined();
    expect(resolverItemAtivo('/colaboradores', ITENS)).toBe('equipe');
  });

  it('retorna undefined para rotas fora da sidebar', () => {
    expect(resolverItemAtivo('/notificacoes', ITENS)).toBeUndefined();
  });
});
