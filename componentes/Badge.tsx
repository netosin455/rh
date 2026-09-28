import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { espaco, raio } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { useMotion } from '../estilo/movimento';

type BadgeProps = { label: string; tone?: 'gold' | 'success' | 'danger' | 'info' | 'muted' };

const tones = {
  gold: { backgroundColor: theme.accent.superficie, color: theme.accent.douradoProfundo },
  success: { backgroundColor: theme.status.sucesso.superficie, color: theme.status.sucesso.forte },
  danger: { backgroundColor: theme.status.erro.superficie, color: theme.status.erro.forte },
  info: { backgroundColor: theme.status.informacao.superficie, color: theme.status.informacao.forte },
  muted: { backgroundColor: theme.superficie.sutil, color: theme.texto.discreto },
} as const;

export function Badge({ label, tone = 'muted' }: BadgeProps) {
  const motion = useMotion();
  const backgroundColor = useSharedValue(tones[tone].backgroundColor);
  const color = useSharedValue(tones[tone].color);

  useEffect(() => {
    backgroundColor.value = withTiming(tones[tone].backgroundColor, { duration: motion.duracao('fast'), easing: motion.entrada });
    color.value = withTiming(tones[tone].color, { duration: motion.duracao('fast'), easing: motion.entrada });
  }, [backgroundColor, color, motion, tone]);

  const badgeStyle = useAnimatedStyle(() => ({ backgroundColor: backgroundColor.value }));
  const textStyle = useAnimatedStyle(() => ({ color: color.value }));

  return (
    <Animated.View accessibilityRole="text" accessibilityLabel={label} style={[styles.badge, badgeStyle]}>
      <Animated.Text style={[styles.text, textStyle]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: raio.pill, paddingHorizontal: espaco.sm, paddingVertical: espaco.xs },
  text: { ...tipografia.legenda },
});
