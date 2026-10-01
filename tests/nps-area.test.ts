// tests/nps-area.test.ts
// NPS é uma ÁREA PRÓPRIA (item no menu), separada de Pesquisas (colaboradores).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deveMostrarShell, resolverItemAtivo } from '../helpers/navegacao';
import { AREAS_PESQUISA, TIPOS_POR_AREA, TIPOS_PERGUNTA } from '../helpers/pesquisa';
import { SHELL_GROUPS, canAccessNavigation } from '../helpers/shellNav';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn().mockResolvedValue(null), removeItem: vi.fn().mockResolvedValue(undefined), setItem: vi.fn().mockResolvedValue(undefined) },
}));

const itens = SHELL_GROUPS.flatMap((g) => g.items);

describe('menu lateral', () => {
  it('o item NPS existe, logo depois de Pesquisas, na mesma permissão', () => {
    const grupo = SHELL_GROUPS.find((g) => g.items.some((i) => i.key === 'pesquisas'));
    const chaves = grupo?.items.map((i) => i.key) ?? [];
    expect(chaves.indexOf('nps')).toBe(chaves.indexOf('pesquisas') + 1);
    const nps = itens.find((i) => i.key === 'nps');
    const pesquisas = itens.find((i) => i.key === 'pesquisas');
    expect(nps).toMatchObject({ title: 'NPS', href: '/nps' });
    expect(nps?.roles).toEqual(pesquisas?.roles);
    for (const role of ['super_admin', 'admin', 'rh', 'adm', 'gestor', undefined]) {
      expect(canAccessNavigation(nps?.roles ?? null, role)).toBe(canAccessNavigation(pesquisas?.roles ?? null, role));
    }
  });

  it('/nps, /nps/nova e /nps/12 ativam o item NPS; /pesquisas continua ativando Pesquisas', () => {
    for (const rota of ['/nps', '/nps/nova', '/nps/12']) expect(resolverItemAtivo(rota, itens), rota).toBe('nps');
    for (const rota of ['/pesquisas', '/pesquisas/nova', '/pesquisas/7']) expect(resolverItemAtivo(rota, itens), rota).toBe('pesquisas');
  });

  it('o item NPS não "rouba" rotas parecidas', () => {
    expect(resolverItemAtivo('/npsx', itens)).toBeUndefined();
  });

  it('a sidebar aparece nas telas do NPS; a resposta pública do cliente continua sem sidebar', () => {
    for (const rota of ['/nps', '/nps/nova', '/nps/12']) expect(deveMostrarShell(rota), rota).toBe(true);
    expect(deveMostrarShell('/responder/12')).toBe(false);
  });

  it('chaves do menu continuam únicas', () => {
    expect(new Set(itens.map((i) => i.key)).size).toBe(itens.length);
  });
});

describe('áreas', () => {
  it('Pesquisas é só colaboradores e NPS é só clientes', () => {
    expect(AREAS_PESQUISA.pesquisas.audience).toBe('employees');
    expect(AREAS_PESQUISA.nps.audience).toBe('customers');
  });

  it('rotas de cada área', () => {
    expect(AREAS_PESQUISA.pesquisas).toMatchObject({ rotaRaiz: '/pesquisas', rotaNova: '/pesquisas/nova' });
    expect(AREAS_PESQUISA.pesquisas.rotaDetalhe(5)).toBe('/pesquisas/5');
    expect(AREAS_PESQUISA.nps).toMatchObject({ rotaRaiz: '/nps', rotaNova: '/nps/nova' });
    expect(AREAS_PESQUISA.nps.rotaDetalhe(5)).toBe('/nps/5');
  });

  it('o tipo NPS 0–10 só aparece na área NPS; Escolha só em Pesquisas', () => {
    expect(TIPOS_POR_AREA.pesquisas).toEqual(['scale', 'choice', 'text']);
    expect(TIPOS_POR_AREA.nps).toEqual(['nps', 'scale', 'text']);
    expect(TIPOS_POR_AREA.pesquisas).not.toContain('nps');
    expect(TIPOS_POR_AREA.nps).not.toContain('choice');
  });

  it('todo tipo oferecido por alguma área tem descrição no seletor', () => {
    const conhecidos = TIPOS_PERGUNTA.map((t) => t.tipo);
    for (const tipos of Object.values(TIPOS_POR_AREA)) for (const t of tipos) expect(conhecidos).toContain(t);
  });
});

describe('listagem por público', () => {
  const mockFetch = vi.fn();
  beforeEach(() => { mockFetch.mockReset(); vi.stubGlobal('fetch', mockFetch); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  async function carregar() {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.teste');
    return import('../conexoes/pesquisas');
  }

  it('sem argumento pede employees; NPS pede customers', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    const { getSurveys } = await carregar();
    await getSurveys();
    await getSurveys('customers');
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('https://api.teste/api/surveys?audience=employees');
    expect(String(mockFetch.mock.calls[1]?.[0])).toBe('https://api.teste/api/surveys?audience=customers');
  });

  it('marcar contatado e apagar contato usam a rota existente com ?contact=', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ contacted_at: '2026-10-03T10:00:00Z' }) } as Response);
    const { marcarContatado, apagarContato } = await carregar();
    await marcarContatado(20, 908);
    await apagarContato(20, 909);
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('https://api.teste/api/surveys/20?contact=908');
    expect(mockFetch.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(String(mockFetch.mock.calls[1]?.[0])).toBe('https://api.teste/api/surveys/20?contact=909');
    expect(mockFetch.mock.calls[1]?.[1]?.method).toBe('DELETE');
  });
});
