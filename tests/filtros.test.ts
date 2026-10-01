// tests/filtros.test.ts
import { describe, expect, it } from 'vitest';
import { combinaComFiltroEquipe, lerAbaFerias, lerFiltroEquipe, rotaEquipe, rotaFerias } from '../helpers/filtros';

describe('filtro da Equipe na URL', () => {
  it('aceita os filtros conhecidos; ausente ou inválido vira "todos"', () => {
    for (const f of ['ativo', 'ferias', 'licenca', 'afastado', 'licenca_afastado', 'desligado'] as const) expect(lerFiltroEquipe(f)).toBe(f);
    for (const ruim of [undefined, '', 'todos', 'ATIVO', 'Desligado', 'x', '<script>']) expect(lerFiltroEquipe(ruim), String(ruim)).toBe('todos');
    expect(lerFiltroEquipe(['ferias', 'ativo'])).toBe('ferias');
    expect(lerFiltroEquipe([])).toBe('todos');
  });

  it('licença cobre as variantes; licenca_afastado soma Afastado; os outros são exatos', () => {
    expect(combinaComFiltroEquipe('licenca_medica', 'licenca')).toBe(true);
    expect(combinaComFiltroEquipe('licenca_maternidade', 'licenca')).toBe(true);
    expect(combinaComFiltroEquipe('afastado', 'licenca')).toBe(false);
    expect(combinaComFiltroEquipe('afastado', 'licenca_afastado')).toBe(true);
    expect(combinaComFiltroEquipe('licenca_paternidade', 'licenca_afastado')).toBe(true);
    expect(combinaComFiltroEquipe('ativo', 'licenca_afastado')).toBe(false);
    expect(combinaComFiltroEquipe('desligado', 'desligado')).toBe(true);
    expect(combinaComFiltroEquipe('ativo', 'desligado')).toBe(false);
    expect(combinaComFiltroEquipe('ativo', 'ativo')).toBe(true);
    expect(combinaComFiltroEquipe('ferias', 'ativo')).toBe(false);
    expect(combinaComFiltroEquipe('desligado', 'todos')).toBe(true);
  });

  it('o card "Em licença" do Analytics (licenca + afastado) bate com o filtro composto', () => {
    const equipe = ['ativo', 'licenca', 'licenca_medica', 'afastado', 'afastado', 'ferias'];
    const contagemDoCard = equipe.filter((s) => s === 'licenca').length + equipe.filter((s) => s === 'afastado').length;
    expect(equipe.filter((s) => combinaComFiltroEquipe(s, 'licenca_afastado')).length).toBeGreaterThanOrEqual(contagemDoCard);
  });

  it('rotas', () => {
    expect(rotaEquipe()).toBe('/colaboradores');
    expect(rotaEquipe('todos')).toBe('/colaboradores');
    expect(rotaEquipe('ativo')).toBe('/colaboradores?status=ativo');
    expect(rotaEquipe('licenca_afastado')).toBe('/colaboradores?status=licenca_afastado');
  });
});

describe('aba de Férias na URL', () => {
  it('aceita os tipos de ausência; ausente ou inválido vira "todos"', () => {
    for (const a of ['falta', 'ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'folga', 'outro'] as const) expect(lerAbaFerias(a)).toBe(a);
    for (const ruim of [undefined, '', 'todos', 'FALTA', 'pendentes', 'x']) expect(lerAbaFerias(ruim), String(ruim)).toBe('todos');
    expect(lerAbaFerias(['folga'])).toBe('folga');
  });

  it('rotas', () => {
    expect(rotaFerias()).toBe('/ferias');
    expect(rotaFerias('falta')).toBe('/ferias?tab=falta');
  });
});
