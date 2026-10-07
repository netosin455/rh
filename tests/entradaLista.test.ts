// tests/entradaLista.test.ts — atrasos da entrada escalonada: bordas 0, 7, 8, 49, 50, 51 e reduzir movimento
import { describe, expect, it } from 'vitest';
import { DURACAO_ENTRADA_ITEM_MS, DESLOCAMENTO_ENTRADA_PX, INTERVALO_ENTRADA_MS, atrasoDeEntrada, duracaoTotalDaEntrada } from '../helpers/entradaLista';

describe('atrasoDeEntrada', () => {
  it('o primeiro item entra sem atraso e o 8º (índice 7) com 7 intervalos do dial', () => {
    expect(atrasoDeEntrada(0, 10, false)).toBe(0);
    expect(atrasoDeEntrada(1, 10, false)).toBe(INTERVALO_ENTRADA_MS);
    expect(atrasoDeEntrada(7, 10, false)).toBe(7 * INTERVALO_ENTRADA_MS);
  });

  it('do 9º item em diante (índice 8+) não anima: aparece junto, sem escalonar', () => {
    expect(atrasoDeEntrada(8, 10, false)).toBeNull();
    expect(atrasoDeEntrada(49, 50, false)).toBeNull();
  });

  it('lista de até 50 itens anima os 8 primeiros; com 51 ou mais não anima nenhum', () => {
    expect(atrasoDeEntrada(0, 50, false)).toBe(0);
    expect(atrasoDeEntrada(7, 50, false)).toBe(7 * INTERVALO_ENTRADA_MS);
    expect(atrasoDeEntrada(0, 51, false)).toBeNull();
    expect(atrasoDeEntrada(7, 51, false)).toBeNull();
  });

  it('reduzir movimento: nada anima', () => {
    expect(atrasoDeEntrada(0, 3, true)).toBeNull();
    expect(atrasoDeEntrada(5, 20, true)).toBeNull();
  });

  it('índice inválido não anima', () => {
    expect(atrasoDeEntrada(-1, 5, false)).toBeNull();
    expect(atrasoDeEntrada(1.5, 5, false)).toBeNull();
  });
});

describe('duracaoTotalDaEntrada', () => {
  it('um item: só a duração do item; 8 ou mais: 7 intervalos + duração', () => {
    expect(duracaoTotalDaEntrada(1, false)).toBe(DURACAO_ENTRADA_ITEM_MS);
    expect(duracaoTotalDaEntrada(8, false)).toBe(7 * INTERVALO_ENTRADA_MS + DURACAO_ENTRADA_ITEM_MS);
    expect(duracaoTotalDaEntrada(50, false)).toBe(7 * INTERVALO_ENTRADA_MS + DURACAO_ENTRADA_ITEM_MS);
  });

  it('vazio, lista grande e reduzir movimento: zero', () => {
    expect(duracaoTotalDaEntrada(0, false)).toBe(0);
    expect(duracaoTotalDaEntrada(51, false)).toBe(0);
    expect(duracaoTotalDaEntrada(5, true)).toBe(0);
  });

  it('respeita os limites do plano: entrada de conteúdo ≤ 250 ms por item e deslocamento ≤ 12 px', () => {
    expect(DURACAO_ENTRADA_ITEM_MS).toBeLessThanOrEqual(250);
    expect(DESLOCAMENTO_ENTRADA_PX).toBeLessThanOrEqual(12);
  });
});
