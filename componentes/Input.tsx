import { forwardRef, ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { useMotion } from '../estilo/movimento';

type InputProps = TextInputProps & {
  label: string;
  /** Mostra "obrigatório" no rótulo e avisa leitores de tela (", obrigatório"). */
  required?: boolean;
  /** Formato esperado (ex.: "DD/MM/AAAA"). Aparece ANTES do erro, para a pessoa saber o que digitar. */
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightAccessory?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    required,
    hint,
    error,
    containerStyle,
    inputStyle,
    rightAccessory,
    placeholderTextColor = theme.texto.discreto,
    accessibilityLabel,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const motion = useMotion();
  const focused = useSharedValue(0);
  const focusDuration = motion.duracao('fast');
  const inputRowStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(error ? theme.status.erro.forte : focused.value ? theme.foco.anel : theme.bordaSemantica.sutil, {
      duration: focusDuration,
      easing: motion.entrada,
    }),
  }));

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.obrigatorio}> · obrigatório</Text> : null}
      </Text>
      <Animated.View style={[styles.inputRow, inputRowStyle, error && styles.inputError]}>
        <TextInput
          {...props}
          ref={ref}
          accessibilityLabel={`${accessibilityLabel ?? label}${required ? ', obrigatório' : ''}`}
          accessibilityHint={error || hint || props.accessibilityHint}
          aria-invalid={error ? true : undefined}
          aria-required={required ? true : undefined}
          onFocus={(event) => {
            focused.value = 1;
            onFocus?.(event);
          }}
          onBlur={(event) => {
            focused.value = 0;
            onBlur?.(event);
          }}
          placeholderTextColor={placeholderTextColor}
          style={[styles.input, inputStyle]}
        />
        {rightAccessory}
      </Animated.View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {/* Região viva: leitores de tela anunciam o erro assim que ele aparece. */}
      {error ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  obrigatorio: { color: theme.texto.discreto, fontWeight: '400', textTransform: 'none' },
  hint: { ...tipografia.legenda, color: theme.texto.discreto, marginTop: espaco.xs },
  label: { ...tipografia.rotulo, color: theme.texto.discreto, marginBottom: espaco.xs, textTransform: 'uppercase' },
  inputRow: { alignItems: 'center', backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.sutil, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', minHeight: tamanho.toqueMinimo },
  input: { ...tipografia.corpo, color: theme.texto.primario, flex: 1, minHeight: tamanho.toqueMinimo, minWidth: 0, paddingHorizontal: espaco.md, paddingVertical: espaco.sm },
  inputError: { borderColor: theme.status.erro.forte },
  error: { ...tipografia.legenda, color: theme.status.erro.forte, marginTop: espaco.xs },
});
