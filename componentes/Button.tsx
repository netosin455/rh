import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, opacidade, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { movimento, useMotion } from '../estilo/movimento';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonProps = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Button({
  label,
  icon,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  children,
}: ButtonProps) {
  const motion = useMotion();
  const pressed = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;
  const pressDuration = motion.duracao('instant');
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(pressed.value && !motion.reduzMovimento ? movimento.deslocamento.press : 1, {
      duration: pressDuration,
      easing: motion.entrada,
    }) }],
  }));

  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? theme.texto.sobreAccent : variant === 'danger' ? theme.status.erro.forte : theme.accent.douradoProfundo} />
  ) : (
    <>
      {icon ? <Ionicons name={icon} size={tamanho.iconePequeno} color={variant === 'primary' ? theme.texto.sobreAccent : variant === 'danger' ? theme.status.erro.forte : theme.accent.douradoProfundo} /> : null}
      {label ? <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : variant === 'danger' ? styles.dangerLabel : styles.secondaryLabel]}>{label}</Text> : null}
      {children}
    </>
  );

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? 'Botão'}
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      onPressIn={() => { pressed.value = 1; }}
      onPressOut={() => { pressed.value = 0; }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        style,
        focused && styles.focus,
        unavailable && styles.disabled,
        animatedStyle,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: raio.controle, flexDirection: 'row', gap: espaco.sm, justifyContent: 'center', minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.lg },
  primary: { backgroundColor: theme.accent.dourado },
  secondary: { backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.forte, borderWidth: borda.fina },
  ghost: { backgroundColor: theme.superficie.transparente, borderColor: theme.superficie.transparente },
  danger: { backgroundColor: theme.status.erro.superficie, borderColor: theme.status.erro.borda },
  focus: { borderColor: theme.foco.anel, borderWidth: borda.foco },
  disabled: { opacity: opacidade.desabilitado },
  label: { ...tipografia.corpoForte },
  primaryLabel: { color: theme.texto.sobreAccent },
  secondaryLabel: { color: theme.texto.primario },
  dangerLabel: { color: theme.status.erro.forte },
});
