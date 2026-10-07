// ============================================================
// componentes/EntradaItem.tsx — SuperRH
// Envolve UM item de lista com entrada, saída e reacomodação suaves (fluidez F2/F3, intensidade média).
//  - entrada: opacity 0→1 e deslocamento vertical do dial (estilo/dial.ts, ≤ 12 px, ≤ 250 ms), escalonada (helpers/entradaLista.ts);
//  - saída (excluir/aprovar/marcar lida): fade de 160 ms; os vizinhos sobem com LinearTransition de 200 ms;
//  - o item é interativo desde o 1º frame (só opacity/transform, sem overlay);
//  - com "reduzir movimento" nada anima.
// A estrutura (Animated.View) é SEMPRE a mesma: mudar de modo nunca remonta o item.
// ============================================================

import { PropsWithChildren, useEffect, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ModoEntrada } from '../contextos/usarRevelacao';
import { DESLOCAMENTO_ENTRADA_PX, DURACAO_ENTRADA_ITEM_MS, atrasoDeEntrada } from '../helpers/entradaLista';
import { movimento, useMotion } from '../estilo/movimento';

const DURACAO_SAIDA_MS = 160;
const DURACAO_REACOMODAR_MS = movimento.duracao.normal;
const DURACAO_RAPIDA_MS = 150;

type EntradaItemProps = PropsWithChildren<{
  indice: number;
  total: number;
  modo: ModoEntrada;
  /** false = sem fade de saída nem reacomodação (listas filtráveis por busca/aba: itens somem a cada tecla). */
  saida?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Duas camadas de propósito: a de fora leva as animações de layout do Reanimated (saída, reacomodação, entrada
 * rápida), a de dentro leva a entrada escalonada por valor compartilhado (opacity + translateY). Misturar as duas
 * no mesmo elemento fazia a reacomodação dos vizinhos falhar na web (o espaço do item removido ficava vazio).
 */
export function EntradaItem({ indice, total, modo, saida = true, style, children }: EntradaItemProps) {
  const motion = useMotion();
  const reduz = motion.reduzMovimento;
  const atraso = modo === 'escalonado' ? atrasoDeEntrada(indice, total, reduz) : null;
  const progresso = useSharedValue(atraso === null ? 1 : 0);

  useEffect(() => {
    // Só no momento em que o item aparece (montagem): mudar o modo depois não reanima um item que já está na tela.
    if (atraso !== null) progresso.value = withDelay(atraso, withTiming(1, { duration: DURACAO_ENTRADA_ITEM_MS, easing: movimento.curva.entradaMarcada }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entering = useMemo(() => (reduz || modo !== 'rapido' ? undefined : FadeIn.duration(DURACAO_RAPIDA_MS)), [reduz, modo]);
  const exiting = useMemo(() => (reduz || !saida ? undefined : FadeOut.duration(DURACAO_SAIDA_MS)), [reduz, saida]);
  const layout = useMemo(() => (reduz || !saida ? undefined : LinearTransition.duration(DURACAO_REACOMODAR_MS)), [reduz, saida]);
  const estiloEntrada = useAnimatedStyle(() => ({ opacity: progresso.value, transform: [{ translateY: (1 - progresso.value) * DESLOCAMENTO_ENTRADA_PX }] }));

  return (
    <Animated.View entering={entering} exiting={exiting} layout={layout} style={style}>
      <Animated.View style={estiloEntrada}>{children}</Animated.View>
    </Animated.View>
  );
}
