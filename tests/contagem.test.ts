// tests/contagem.test.ts — contagem animada: interpolação, arredondamento, valor final exato, reduzir movimento
import { describe, expect, it } from 'vitest';
import { dial } from '../estilo/dial';
import { DURACAO_CONTAGEM_MS, atrasoDaBarra, formatarContagem, pontoDePartida, progressoDaContagem, suavizar, valorDaContagem } from '../helpers/contagem';

describe('suavizar / progressoDaContagem', () => {
  it('começa em 0, termina em 1 e é monotônica (ease-out: passa da metade antes da metade do tempo)', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.5)).toBeGreaterThan(0.5);
    expect(suavizar(0.3)).toBeLessThan(suavizar(0.6));
    expect(suavizar(-1)).toBe(0);
    expect(suavizar(5)).toBe(1);
  });

  it('reduzir movimento ou duração inválida: já no valor final', () => {
    expect(progressoDaContagem(0, 500, true)).toBe(1);
    expect(progressoDaContagem(0, 0, false)).toBe(1);
    expect(progressoDaContagem(250, 500, false)).toBeGreaterThan(0.5);
  });

  it('a duração fica entre 400 e 600 ms', () => {
    expect(DURACAO_CONTAGEM_MS).toBeGreaterThanOrEqual(400);
    expect(DURACAO_CONTAGEM_MS).toBeLessThanOrEqual(600);
  });
});

describe('valorDaContagem', () => {
  it('interpola entre o valor anterior e o novo, arredondando às casas decimais', () => {
    expect(valorDaContagem(0, 100, 0.5)).toBe(50);
    expect(valorDaContagem(10, 20, 0.33)).toBe(13);
    expect(valorDaContagem(0, 10, 0.123, 1)).toBe(1.2);
  });

  it('inteiro nunca devolve fração no meio da contagem', () => {
    for (let t = 0.01; t < 1; t += 0.037) expect(Number.isInteger(valorDaContagem(3, 87, t, 0))).toBe(true);
  });

  it('em t >= 1 o valor final é EXATO, sem resto de ponto flutuante', () => {
    expect(valorDaContagem(0, 0.1 + 0.2, 1, 1)).toBe(0.1 + 0.2);
    expect(valorDaContagem(5, 37.5, 1, 1)).toBe(37.5);
    expect(valorDaContagem(0, 12, 1.0000001)).toBe(12);
  });

  it('contagem para baixo também funciona; t <= 0 devolve o ponto de partida', () => {
    expect(valorDaContagem(100, 0, 0.5)).toBe(50);
    expect(valorDaContagem(7, 3, 0)).toBe(7);
  });

  it('valores não finitos caem direto no valor final', () => {
    expect(valorDaContagem(Number.NaN, 4, 0.5)).toBe(4);
  });
});

describe('formatarContagem (pt-BR)', () => {
  it('inteiro com separador de milhar', () => {
    expect(formatarContagem(1234)).toBe('1.234');
    expect(formatarContagem(0)).toBe('0');
  });

  it('decimal com vírgula e casas fixas', () => {
    expect(formatarContagem(12.5, { decimais: 1 })).toBe('12,5');
    expect(formatarContagem(3, { decimais: 1 })).toBe('3,0');
  });

  it('com sinal (NPS): + nos positivos, − tipográfico nos negativos, zero sem sinal', () => {
    expect(formatarContagem(45, { sinal: true })).toBe('+45');
    expect(formatarContagem(-12, { sinal: true })).toBe('−12');
    expect(formatarContagem(0, { sinal: true })).toBe('0');
  });

  it('porcentagem e prefixo', () => {
    expect(formatarContagem(87, { sufixo: '%' })).toBe('87%');
    expect(formatarContagem(-12, { prefixo: '' })).toBe('-12');
    expect(formatarContagem(4.25, { decimais: 2, sufixo: ' dias' })).toBe('4,25 dias');
  });
});

describe('atrasoDaBarra', () => {
  it('escalona até 8 barras com o intervalo do dial e para de crescer', () => {
    expect(atrasoDaBarra(0)).toBe(0);
    expect(atrasoDaBarra(1)).toBe(dial.intervaloBarrasMs);
    expect(atrasoDaBarra(7)).toBe(7 * dial.intervaloBarrasMs);
    expect(atrasoDaBarra(30)).toBe(7 * dial.intervaloBarrasMs);
  });

  it('índice inválido não atrasa; o intervalo nunca passa de 60 ms', () => {
    expect(atrasoDaBarra(-1)).toBe(0);
    expect(atrasoDaBarra(1.5)).toBe(0);
    expect(dial.intervaloBarrasMs).toBeLessThanOrEqual(60);
  });
});

describe('pontoDePartida (quando anima)', () => {
  it('1ª aparição vinda de esqueleto: conta a partir de 0', () => {
    expect(pontoDePartida({ anterior: undefined, novo: 42, vindoDeEsqueleto: true, reduzMovimento: false })).toBe(0);
  });

  it('1ª aparição com cache (revisita): mostra pronto, sem animar', () => {
    expect(pontoDePartida({ anterior: undefined, novo: 42, vindoDeEsqueleto: false, reduzMovimento: false })).toBeNull();
  });

  it('valor mudou: anima do anterior ao novo; igual: nada', () => {
    expect(pontoDePartida({ anterior: 10, novo: 12, vindoDeEsqueleto: false, reduzMovimento: false })).toBe(10);
    expect(pontoDePartida({ anterior: 12, novo: 12, vindoDeEsqueleto: true, reduzMovimento: false })).toBeNull();
  });

  it('reduzir movimento: instantâneo em qualquer caso', () => {
    expect(pontoDePartida({ anterior: undefined, novo: 42, vindoDeEsqueleto: true, reduzMovimento: true })).toBeNull();
    expect(pontoDePartida({ anterior: 1, novo: 2, vindoDeEsqueleto: false, reduzMovimento: true })).toBeNull();
  });

  it('valor inválido não anima', () => {
    expect(pontoDePartida({ anterior: 1, novo: Number.NaN, vindoDeEsqueleto: true, reduzMovimento: false })).toBeNull();
  });
});
