import { useContext, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { VindoDeEsqueletoContexto } from '../contextos/VindoDeEsqueleto';
import { theme } from '../estilo/cores';
import { largura, raio, tamanho } from '../estilo/espaco';
import { dial, movimento, useMotion } from '../estilo/movimento';

type ProgressTone = 'accent' | 'success' | 'info' | 'danger';

type ProgressBarProps = {
  value: number;
  tone?: ProgressTone;
  accessibilityLabel?: string;
  /** Atraso (ms) da 1ª subida, para escalonar várias barras (≤ 60 ms entre barras: use indice * dial.intervaloBarrasMs). */
  atrasoMs?: number;
};

const fillColors: Record<ProgressTone, string> = {
  accent: theme.accent.dourado,
  success: theme.status.sucesso.forte,
  info: theme.status.informacao.forte,
  danger: theme.status.erro.forte,
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function ProgressBar({ value, tone = 'accent', accessibilityLabel = 'Progresso', atrasoMs = 0 }: ProgressBarProps) {
  const motion = useMotion();
  const vindoDeEsqueleto = useContext(VindoDeEsqueletoContexto);
  // Cresce do zero só quando acabou de sair do esqueleto; com cache (revisita) já nasce no valor. Reduzir movimento: sempre direto.
  const nasceCheia = motion.reduzMovimento || !vindoDeEsqueleto;
  const progress = useSharedValue(nasceCheia ? clamp(value) : 0);
  const primeira = useRef(true);

  useEffect(() => {
    const alvo = clamp(value);
    if (motion.reduzMovimento) { progress.value = alvo; primeira.current = false; return; }
    const anima = withTiming(alvo, { duration: dial.barraMs, easing: movimento.curva.entradaMarcada });
    progress.value = primeira.current && atrasoMs > 0 ? withDelay(atrasoMs, anima) : anima;
    primeira.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion.reduzMovimento, progress, value]);

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
