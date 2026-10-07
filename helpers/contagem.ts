// ============================================================
// helpers/contagem.ts — SuperRH
// Cálculo da contagem animada de números (fluidez F3). Lógica pura, sem React, para testar o que importa:
//  - o valor FINAL é sempre exato (sem resto de ponto flutuante nem arredondamento errado);
//  - os valores intermediários respeitam as casas decimais do formato (inteiro nunca mostra "12,3");
//  - com "reduzir movimento" o valor é imediato;
//  - só anima quando o valor muda ou na 1ª aparição vinda de um esqueleto — nunca em revisita com cache.
// ============================================================

import { dial } from '../estilo/dial';

export const DURACAO_CONTAGEM_MS = dial.contagemMs;

export interface FormatoContagem {
  /** Casas decimais exibidas (0 = inteiro). */
  decimais?: number;
  /** Texto antes/depois do número (ex.: sufixo "%"). */
  prefixo?: string;
  sufixo?: string;
  /** Mostra "+" nos positivos e "−" (sinal de menos tipográfico) nos negativos, como o NPS (+45 / −12). */
  sinal?: boolean;
}

/** Easing de saída (rápido no começo, assenta devagar): cúbico. */
export function suavizar(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** Fração 0..1 já suavizada. `reduzMovimento` ou duração inválida = 1 (valor final de uma vez). */
export function progressoDaContagem(decorridoMs: number, duracaoMs: number, reduzMovimento: boolean): number {
  if (reduzMovimento || !(duracaoMs > 0)) return 1;
  return suavizar(decorridoMs / duracaoMs);
}

function arredondar(valor: number, decimais: number): number {
  const f = Math.pow(10, decimais);
  return Math.round(valor * f) / f;
}

/** Valor mostrado no instante `t` (já suavizado, 0..1). Em t >= 1 devolve EXATAMENTE `para`. */
export function valorDaContagem(de: number, para: number, t: number, decimais = 0): number {
  if (!Number.isFinite(de) || !Number.isFinite(para)) return para;
  if (t >= 1) return para;
  if (t <= 0) return arredondar(de, decimais);
  return arredondar(de + (para - de) * t, decimais);
}

/** Formata em pt-BR: milhar com ponto, decimal com vírgula, com prefixo/sufixo. */
export function formatarContagem(valor: number, formato: FormatoContagem = {}): string {
  const decimais = formato.decimais ?? 0;
  const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais }).format(formato.sinal ? Math.abs(valor) : valor);
  const sinal = formato.sinal ? (valor > 0 ? '+' : valor < 0 ? '−' : '') : '';
  return `${formato.prefixo ?? ''}${sinal}${numero}${formato.sufixo ?? ''}`;
}

/** Atraso (ms) da barra `indice` numa lista: escalona até 8 barras (≤ 60 ms entre elas); as demais sobem junto com a última. */
export function atrasoDaBarra(indice: number): number {
  if (!Number.isInteger(indice) || indice < 0) return 0;
  return Math.min(indice, 7) * dial.intervaloBarrasMs;
}

export interface EntradaDecisao {
  /** Valor anteriormente mostrado, ou undefined na 1ª aparição do número. */
  anterior: number | undefined;
  novo: number;
  /** A tela acabou de sair de um esqueleto (nunca true em revisita com cache). */
  vindoDeEsqueleto: boolean;
  reduzMovimento: boolean;
}

/**
 * De que valor a contagem parte, ou null = sem animação (mostrar o valor final direto).
 *  - reduzir movimento: nunca anima;
 *  - 1ª aparição: só anima (a partir de 0) se veio de um esqueleto; com cache aparece pronto;
 *  - valor mudou: anima do anterior ao novo; igual: nada.
 */
export function pontoDePartida(d: EntradaDecisao): number | null {
  if (d.reduzMovimento || !Number.isFinite(d.novo)) return null;
  if (d.anterior === undefined) return d.vindoDeEsqueleto ? 0 : null;
  return d.anterior === d.novo ? null : d.anterior;
}
