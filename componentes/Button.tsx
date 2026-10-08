import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { registrarBotaoDeSalvar } from '../helpers/confirmacaoSalvo';
import { usePressEscala } from './pressionar';
import { theme } from '../estilo/cores';
import { borda, espaco, opacidade, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { dial, useMotion } from '../estilo/movimento';

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
  const apenasIcone = !label && !children;
  const press = usePressEscala(apenasIcone ? 'icone' : 'padrao');
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;

  // "Salvo" (F4): enquanto o botão está em "carregando" ele atende o aviso de sucesso da tela (helpers/confirmacaoSalvo).
  const [salvo, setSalvo] = useState(false);
  const larguraRef = useRef<number | undefined>(undefined);
  const checkProgresso = useSharedValue(motion.reduzMovimento ? 1 : 0);
  useEffect(() => {
    if (!loading) { setSalvo(false); return undefined; }
    return registrarBotaoDeSalvar(() => {
      checkProgresso.value = motion.reduzMovimento ? 1 : 0;
      if (!motion.reduzMovimento) checkProgresso.value = withTiming(1, { duration: dial.salvoEntradaMs, easing: motion.entrada });
      setSalvo(true);
      return { reduzMovimento: motion.reduzMovimento };
    });
  }, [loading, motion, checkProgresso]);
  const checkStyle = useAnimatedStyle(() => ({ opacity: checkProgresso.value, transform: [{ scale: 0.6 + 0.4 * checkProgresso.value }] }));

  const content = salvo ? (
    <Animated.View style={[styles.salvo, checkStyle]}>
      <Ionicons name="checkmark-circle" size={tamanho.iconeMedio} color={variant === 'primary' ? theme.texto.sobreAccent : theme.status.sucesso.forte} />
      <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>Salvo</Text>
    </Animated.View>
  ) : loading ? (
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
      accessibilityLabel={salvo ? 'Salvo' : accessibilityLabel ?? label ?? 'Botão'}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: loading && !salvo, disabled: unavailable }}
      disabled={unavailable}
      onLayout={(e) => { if (!salvo) larguraRef.current = e.nativeEvent.layout.width; }}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        style,
        focused && styles.focus,
        unavailable && !salvo && styles.disabled,
        salvo && larguraRef.current ? { minWidth: larguraRef.current } : null,
        press.estilo,
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
  salvo: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  label: { ...tipografia.corpoForte },
  primaryLabel: { color: theme.texto.sobreAccent },
  secondaryLabel: { color: theme.texto.primario },
  dangerLabel: { color: theme.status.erro.forte },
});
