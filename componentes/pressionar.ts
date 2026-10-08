// ============================================================
// componentes/pressionar.ts — SuperRH
// Feedback de "pressionado" único do app (fluidez F4): escala 0.98 em 100 ms (botões só de ícone e itens do
// menu: 0.94). Tokens em estilo/dial.ts. Só transform; a ação acontece no 1º frame (isto é só resposta visual);
// com "reduzir movimento" não escala.
// ============================================================

import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { dial, movimento, useMotion } from '../estilo/movimento';

export function usePressEscala(tipo: 'padrao' | 'icone' = 'padrao') {
  const motion = useMotion();
  const pressionado = useSharedValue(0);
  const alvo = tipo === 'icone' ? dial.pressEscalaIcone : dial.pressEscala;
  const reduz = motion.reduzMovimento;
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressionado.value && !reduz ? alvo : 1, { duration: dial.pressMs, easing: movimento.curva.entrada }) }],
  }));
  return {
    /** Valor 0/1 para compor com outros transforms (ex.: hover do Card). */
    pressionado,
    alvo,
    reduz,
    estilo,
    onPressIn: () => { pressionado.value = 1; },
    onPressOut: () => { pressionado.value = 0; },
  };
}
