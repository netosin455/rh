import { useMemo } from 'react';
import { Easing, useReducedMotion } from 'react-native-reanimated';

export const movimento = {
  duracao: {
    instant: 100,
    fast: 140,
    normal: 200,
    estrutural: 260,
  },
  curva: {
    entrada: Easing.out(Easing.cubic),
    saida: Easing.in(Easing.cubic),
  },
  deslocamento: {
    press: 0.98,
    modal: 0.98,
    toast: 32,
    drawer: 40,
  },
  espera: {
    toast: 3200,
  },
} as const;

export type DuracaoMovimento = keyof typeof movimento.duracao;

/**
 * Centraliza a preferência de reduzir movimento. Nesse modo cada transição
 * usa 100 ms e os componentes removem deslocamento/escala, preservando o
 * estado visível por um fade curto ou troca imediata.
 */
export function useMotion() {
  const reduzMovimento = useReducedMotion();

  return useMemo(() => ({
    reduzMovimento,
    entrada: movimento.curva.entrada,
    saida: movimento.curva.saida,
    duracao: (token: DuracaoMovimento) => reduzMovimento ? movimento.duracao.instant : movimento.duracao[token],
    fadeCurto: movimento.duracao.instant,
  }), [reduzMovimento]);
}
