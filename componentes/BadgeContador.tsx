// ============================================================
// componentes/BadgeContador.tsx — SuperRH
// Bolinha numérica (notificações, pendências) com "pop" de escala 1 → 1,15 → 1 em ~220 ms quando `pulso` muda
// (fluidez F4). Só transform; o número já aparece certo no 1º frame; reduzir movimento = sem pop.
// ============================================================

import { StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { dial, movimento, useMotion } from '../estilo/movimento';

type BadgeProps = { valor: number; pulso: number; estilo: StyleProp<ViewStyle>; estiloTexto: StyleProp<TextStyle>; testID?: string };

export function BadgeContador({ valor, pulso, estilo, estiloTexto, testID = 'badge-contador' }: BadgeProps) {
  const motion = useMotion();
  const escala = useSharedValue(1);
  const pulsoVisto = useRef(pulso);

  useEffect(() => {
    if (pulso === pulsoVisto.current) return;
    pulsoVisto.current = pulso;
    if (motion.reduzMovimento) return;
    const metade = Math.round(dial.popMs / 2);
    escala.value = withSequence(
      withTiming(dial.popEscala, { duration: metade, easing: movimento.curva.entrada }),
      withTiming(1, { duration: dial.popMs - metade, easing: movimento.curva.saida }),
    );
  }, [pulso, motion.reduzMovimento, escala]);

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  return (
    <Animated.View style={[estilo, animado]} testID={testID}>
      <Text style={estiloTexto}>{valor > 9 ? '9+' : valor}</Text>
    </Animated.View>
  );
}
