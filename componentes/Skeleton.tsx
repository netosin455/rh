import { useEffect } from 'react';
import { DimensionValue, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { largura, raio, tamanho } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  accessibilityLabel?: string;
  /** true = parte de um grupo (EsqueletoGrupo já anuncia "Carregando"): escondido do leitor de tela. */
  decorativo?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Placeholder com fade de entrada e um brilho suave (a opacidade "respira" entre 100% e 60%, ~1,5 s por ciclo).
 * Só opacity; com "reduzir movimento" fica parado, sem loop.
 */
export function Skeleton({
  width = largura.completa,
  height = tamanho.toqueMinimo,
  borderRadius = raio.controle,
  accessibilityLabel = 'Carregando conteúdo',
  decorativo = false,
  style,
}: SkeletonProps) {
  const motion = useMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (motion.reduzMovimento) { opacity.value = 1; return; }
    opacity.value = withSequence(
      withTiming(1, { duration: motion.duracao('fast'), easing: motion.entrada }),
      withRepeat(withSequence(
        withTiming(0.6, { duration: 750, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.sin) }),
      ), -1),
    );
  }, [motion.reduzMovimento, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      {...(decorativo
        ? { accessibilityElementsHidden: true, 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessibilityRole: 'progressbar' as const, accessibilityLabel, accessibilityState: { busy: true } })}
      style={[styles.skeleton, { width, height, borderRadius }, style, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: theme.superficie.destaque },
});
