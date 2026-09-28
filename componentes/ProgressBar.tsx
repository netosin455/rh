import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { largura, raio, tamanho } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';

type ProgressTone = 'accent' | 'success' | 'info' | 'danger';

type ProgressBarProps = {
  value: number;
  tone?: ProgressTone;
  accessibilityLabel?: string;
};

const fillColors: Record<ProgressTone, string> = {
  accent: theme.accent.dourado,
  success: theme.status.sucesso.forte,
  info: theme.status.informacao.forte,
  danger: theme.status.erro.forte,
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function ProgressBar({ value, tone = 'accent', accessibilityLabel = 'Progresso' }: ProgressBarProps) {
  const motion = useMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamp(value), { duration: motion.duracao('normal'), easing: motion.entrada });
  }, [motion, progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: clamp(value) }} style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: fillColors[tone] }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: theme.superficie.destaque, borderRadius: raio.pill, height: tamanho.barraProgresso, overflow: 'hidden', width: largura.completa },
  fill: { borderRadius: raio.pill, height: tamanho.barraProgresso },
});
