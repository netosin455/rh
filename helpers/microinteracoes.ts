// ============================================================
// helpers/microinteracoes.ts — SuperRH
// Lógica pura das micro-interações da F4 (sem React nem Reanimated, para testar):
//  - onde fica o indicador que desliza entre as opções de um filtro;
//  - quando um contador "subiu" (sino balança e badge dá o pop só aí, nunca na 1ª carga nem quando desce);
//  - tempos do "Salvo" no botão e a sequência do balanço do sino.
// ============================================================

import { dial } from '../estilo/dial';

export interface RetanguloItem { x: number; y: number; largura: number; altura: number }
export type ModoIndicador = 'fundo' | 'linha' | 'moldura';

/** Espessura do indicador em modo "linha" (sublinhado), em px. */
export const ESPESSURA_LINHA_PX = 2;

/**
 * Retângulo do indicador sob a opção selecionada. `fundo` e `moldura` cobrem o item inteiro; `linha` é um
 * sublinhado colado na base do item. undefined = opção ainda não medida (ou nenhuma selecionada).
 */
export function retanguloDoIndicador(itens: Readonly<Record<string, RetanguloItem>>, selecionado: string | null | undefined, modo: ModoIndicador): RetanguloItem | undefined {
  if (selecionado === null || selecionado === undefined) return undefined;
  const r = itens[selecionado];
  if (!r || !(r.largura > 0) || !(r.altura > 0)) return undefined;
  if (modo === 'linha') return { x: r.x, y: r.y + r.altura - ESPESSURA_LINHA_PX, largura: r.largura, altura: ESPESSURA_LINHA_PX };
  return { x: r.x, y: r.y, largura: r.largura, altura: r.altura };
}

/** O contador subiu? `anterior` undefined = ainda não houve leitura confiável (1ª carga): nunca conta como subida. */
export function contadorSubiu(anterior: number | undefined, atual: number): boolean {
  return anterior !== undefined && Number.isFinite(atual) && atual > anterior;
}

/** Duração do "Salvo" no botão (nunca acima de 450 ms); reduzir movimento = sem espera. */
export function duracaoDoSalvo(reduzMovimento: boolean): number {
  return reduzMovimento ? 0 : Math.min(dial.salvoMs, 450);
}

export interface PassoDoSino { graus: number; ms: number }

/** Balanço único do sino: vai a +12°, volta a −12°, e assenta em 0 — o total soma `sinoMs`. */
export function passosDoSino(): PassoDoSino[] {
  const g = dial.sinoGraus;
  const tempos = [0.2, 0.25, 0.2, 0.2, 0.15].map((f) => Math.round(f * dial.sinoMs));
  const graus = [g, -g, g * 0.6, -g * 0.3, 0];
  return graus.map((valor, i) => ({ graus: valor, ms: tempos[i] }));
}
