import { useEffect } from 'react';
import { DimensionValue, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { largura, raio, tamanho } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder estático com fade de entrada, sem shimmer ou loop infinito. */
export function Skeleton({
  width = largura.completa,
  height = tamanho.toqueMinimo,
  borderRadius = raio.controle,
  accessibilityLabel = 'Carregando conteúdo',
  style,
}: SkeletonProps) {
  const motion = useMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.duracao('fast'), easing: motion.entrada });
  }, [motion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      style={[styles.skeleton, { width, height, borderRadius }, style, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: theme.superficie.destaque },
});
