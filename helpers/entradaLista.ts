// ============================================================
// helpers/entradaLista.ts — SuperRH
// Entrada escalonada de listas (fluidez F2). Lógica pura: dado o item, diz com quantos ms de atraso ele
// aparece, ou `null` quando NÃO deve animar. Regras (docs/maestri/core/PLAN_FLUIDEZ.md):
//  - no máximo 8 itens escalonados, 30 ms de intervalo (o 8º entra com 210 ms);
//  - lista com mais de 50 itens não anima entrada;
//  - com "reduzir movimento" nada anima (tudo aparece instantâneo).
// ============================================================

export const LIMITE_ESCALONADO = 8;
export const INTERVALO_ENTRADA_MS = 30;
export const LIMITE_LISTA_ANIMADA = 50;
/** Duração de cada item entrando (nunca passa de 250 ms) e deslocamento vertical máximo (px). */
export const DURACAO_ENTRADA_ITEM_MS = 200;
export const DESLOCAMENTO_ENTRADA_PX = 8;

/** Atraso (ms) do item `indice` numa lista de `total`, ou null = sem animação. */
export function atrasoDeEntrada(indice: number, total: number, reduzMovimento: boolean): number | null {
  if (reduzMovimento) return null;
  if (!Number.isInteger(indice) || indice < 0 || indice >= LIMITE_ESCALONADO) return null;
  if (total > LIMITE_LISTA_ANIMADA) return null;
  return indice * INTERVALO_ENTRADA_MS;
}

/** Tempo total até o último item animado ficar opaco (para medir e para testes). */
export function duracaoTotalDaEntrada(total: number, reduzMovimento: boolean): number {
  if (reduzMovimento || total <= 0 || total > LIMITE_LISTA_ANIMADA) return 0;
  const animados = Math.min(total, LIMITE_ESCALONADO);
  return (animados - 1) * INTERVALO_ENTRADA_MS + DURACAO_ENTRADA_ITEM_MS;
}
