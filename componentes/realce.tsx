// ============================================================
// componentes/realce.tsx — SuperRH
// Realce ao passar o mouse em Card/ListRow clicáveis (web, fluidez F3): o item sobe 1 px e ganha uma
// sombra um pouco maior em 140 ms. Só `transform` e `opacity` (a sombra é uma camada à parte cuja opacidade
// anima), nenhuma mudança de layout (CLS 0) e a camada tem pointerEvents none: nunca bloqueia clique.
// Em toque (nativo) não há hover: o hook devolve valores neutros. Com "reduzir movimento" é instantâneo e sem elevação.
// ============================================================

import { ReactElement, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cores } from '../estilo/cores';
import { dial, movimento, useMotion } from '../estilo/movimento';

const ehWeb = Platform.OS === 'web';

/**
 * Só existe realce quando há hover de verdade (mouse/trackpad): em tela de toque o primeiro toque "gruda" o hover
 * e o item ficaria levantado. `(hover: hover)` é falso em celulares e tablets.
 */
export function haHoverReal(): boolean {
  if (!ehWeb || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover)').matches;
}

export interface Realce {
  /** 0 = em repouso, 1 = com o mouse em cima. Já inclui a regra de movimento reduzido. */
  hover: SharedValue<number>;
  onHoverIn: () => void;
  onHoverOut: () => void;
  /** Camada de sombra para renderizar como PRIMEIRO filho do item (null fora da web). */
  camada: ReactElement | null;
}

/** Estado de hover compartilhado: `hover` entra no estilo animado do item; `camada` entra como filho. */
export function useRealce(raio: number): Realce {
  const motion = useMotion();
  const hover = useSharedValue(0);
  const alvo = useCallback((valor: number) => {
    if (!haHoverReal()) return;
    // Reduzir movimento: sem elevação nem sombra, nada a mostrar.
    if (motion.reduzMovimento) { hover.value = 0; return; }
    hover.value = withTiming(valor, { duration: dial.hoverMs, easing: movimento.curva.entrada });
  }, [hover, motion.reduzMovimento]);

  return {
    hover,
    onHoverIn: () => alvo(1),
    onHoverOut: () => alvo(0),
    camada: haHoverReal() ? <><CamadaAnimada hover={hover} raio={raio} /><FaixaDeApoio /></> : null,
  };
}

/** Deslocamento vertical do realce (px negativos = sobe). Use dentro de um useAnimatedStyle. */
export function elevacaoDoRealce(hover: SharedValue<number>): number {
  'worklet';
  return -dial.hoverElevacaoPx * hover.value;
}

/**
 * Faixa transparente de 1 px colada na base do item. Ao subir 1 px o item deixa uma linha de pixels "vazia" embaixo;
 * sem esta faixa o mouse parado nessa linha sai do item, ele desce, entra de novo, sobe... (tremida na borda).
 * Como é filha do item, conta como "dentro" dele. Em repouso fica sob o vizinho de baixo (que vem depois e pinta por cima).
 */
function FaixaDeApoio() {
  return <View style={styles.apoio} />;
}

function CamadaAnimada({ hover, raio }: { hover: SharedValue<number>; raio: number }) {
  const estilo = useAnimatedStyle(() => ({ opacity: hover.value }));
  return <Animated.View pointerEvents="none" style={[styles.sombra, { borderRadius: raio }, estilo]} />;
}

const styles = StyleSheet.create({
  apoio: { bottom: -dial.hoverElevacaoPx, height: dial.hoverElevacaoPx, left: 0, position: 'absolute', right: 0 },
  // Sombra maior que só aparece no hover; fica atrás do conteúdo (1º filho) e dentro da área do item.
  sombra: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    ...(ehWeb ? ({ boxShadow: `0 4px 14px ${cores.elevacao.realce}` } as object) : null),
  },
});
