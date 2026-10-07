// tests/dial.test.ts — o dial (estilo/dial.ts) nunca passa dos tetos do plano de fluidez
import { describe, expect, it } from 'vitest';
import { dial } from '../estilo/dial';

describe('dial de movimento', () => {
  it('nenhuma entrada de conteúdo passa de 250 ms', () => {
    expect(dial.itemMs).toBeLessThanOrEqual(250);
    expect(dial.telaMs).toBeLessThanOrEqual(250);
    expect(dial.revisitaMs).toBeLessThanOrEqual(120);
    expect(dial.hoverMs).toBeLessThanOrEqual(160);
  });

  it('nenhum deslocamento de entrada passa de 12 px; o hover sobe no máximo 2 px', () => {
    expect(dial.itemPx).toBeLessThanOrEqual(12);
    expect(dial.telaPx).toBeLessThanOrEqual(12);
    expect(dial.hoverElevacaoPx).toBeLessThanOrEqual(2);
  });

  it('intensidade média: valores da F3', () => {
    expect(dial.itemPx).toBe(12);
    expect(dial.itemMs).toBe(240);
    expect(dial.intervaloMs).toBe(40);
    expect(dial.telaPx).toBe(10);
    expect(dial.telaMs).toBe(220);
  });

  it('números e barras dentro das faixas do plano (contagem 400–600, barras 400–500, escalonamento ≤ 60)', () => {
    expect(dial.contagemMs).toBeGreaterThanOrEqual(400);
    expect(dial.contagemMs).toBeLessThanOrEqual(600);
    expect(dial.barraMs).toBeGreaterThanOrEqual(400);
    expect(dial.barraMs).toBeLessThanOrEqual(500);
    expect(dial.intervaloBarrasMs).toBeLessThanOrEqual(60);
  });

  it('a curva é um bezier válido (x entre 0 e 1)', () => {
    const [x1, , x2] = dial.curvaMarcada;
    expect(x1).toBeGreaterThanOrEqual(0); expect(x1).toBeLessThanOrEqual(1);
    expect(x2).toBeGreaterThanOrEqual(0); expect(x2).toBeLessThanOrEqual(1);
  });
});
