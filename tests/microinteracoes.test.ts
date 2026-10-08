// tests/microinteracoes.test.ts — indicador deslizante, contador que sobe, "Salvo" e sino (fluidez F4)
import { describe, expect, it } from 'vitest';
import { dial } from '../estilo/dial';
import { ESPESSURA_LINHA_PX, contadorSubiu, duracaoDoSalvo, passosDoSino, retanguloDoIndicador } from '../helpers/microinteracoes';

const itens = { a: { x: 0, y: 0, largura: 60, altura: 30 }, b: { x: 70, y: 0, largura: 90, altura: 30 }, c: { x: 0, y: 40, largura: 0, altura: 30 } };

describe('retanguloDoIndicador', () => {
  it('fundo/moldura cobrem o item inteiro', () => {
    expect(retanguloDoIndicador(itens, 'b', 'fundo')).toEqual({ x: 70, y: 0, largura: 90, altura: 30 });
    expect(retanguloDoIndicador(itens, 'a', 'moldura')).toEqual({ x: 0, y: 0, largura: 60, altura: 30 });
  });

  it('linha é um sublinhado colado na base do item', () => {
    expect(retanguloDoIndicador(itens, 'b', 'linha')).toEqual({ x: 70, y: 30 - ESPESSURA_LINHA_PX, largura: 90, altura: ESPESSURA_LINHA_PX });
  });

  it('sem seleção, sem medida ou com largura 0: não há indicador', () => {
    expect(retanguloDoIndicador(itens, null, 'fundo')).toBeUndefined();
    expect(retanguloDoIndicador(itens, undefined, 'fundo')).toBeUndefined();
    expect(retanguloDoIndicador(itens, 'z', 'fundo')).toBeUndefined();
    expect(retanguloDoIndicador(itens, 'c', 'fundo')).toBeUndefined();
  });
});

describe('contadorSubiu', () => {
  it('só quando sobe de verdade', () => {
    expect(contadorSubiu(2, 3)).toBe(true);
    expect(contadorSubiu(0, 1)).toBe(true);
    expect(contadorSubiu(3, 3)).toBe(false);
    expect(contadorSubiu(3, 1)).toBe(false);
    expect(contadorSubiu(3, 0)).toBe(false);
  });

  it('a 1ª leitura (anterior desconhecido) nunca conta como subida', () => {
    expect(contadorSubiu(undefined, 5)).toBe(false);
    expect(contadorSubiu(undefined, 0)).toBe(false);
  });

  it('valor inválido não conta', () => {
    expect(contadorSubiu(1, Number.NaN)).toBe(false);
  });
});

describe('tempos', () => {
  it('"Salvo" nunca passa de 450 ms; com reduzir movimento não espera', () => {
    expect(duracaoDoSalvo(false)).toBeLessThanOrEqual(450);
    expect(duracaoDoSalvo(false)).toBeGreaterThan(dial.salvoEntradaMs);
    expect(duracaoDoSalvo(true)).toBe(0);
    expect(dial.salvoEntradaMs).toBeLessThanOrEqual(250);
  });

  it('balanço do sino: ±12°, termina em 0°, dura ~400 ms', () => {
    const passos = passosDoSino();
    expect(Math.max(...passos.map((p) => Math.abs(p.graus)))).toBe(12);
    expect(passos[passos.length - 1].graus).toBe(0);
    const total = passos.reduce((t, p) => t + p.ms, 0);
    expect(total).toBeGreaterThanOrEqual(380);
    expect(total).toBeLessThanOrEqual(420);
  });

  it('press e pop dentro dos limites (micro 100–160 ms, pop ≤ 250 ms, escala do pop 1,15)', () => {
    expect(dial.pressMs).toBeGreaterThanOrEqual(100);
    expect(dial.pressMs).toBeLessThanOrEqual(160);
    expect(dial.popMs).toBeLessThanOrEqual(250);
    expect(dial.popEscala).toBe(1.15);
    expect(dial.pressEscalaIcone).toBe(0.94);
    expect(dial.indicadorMs).toBeLessThanOrEqual(250);
  });
});
