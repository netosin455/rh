import { forwardRef, ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { radius, theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightAccessory?: ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerStyle, inputStyle, rightAccessory, placeholderTextColor = theme.textMuted, ...props },
  ref,
) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputError]}>
        <TextInput
          {...props}
          ref={ref}
          placeholderTextColor={placeholderTextColor}
          style={[styles.input, inputStyle]}
        />
        {rightAccessory}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { color: theme.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.7, marginBottom: 6, textTransform: 'uppercase' },
  inputRow: { alignItems: 'center', backgroundColor: theme.card, borderColor: theme.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', minHeight: 44 },
  input: { color: theme.textPrimary, flex: 1, fontFamily: fonts.body, fontSize: 14, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
  inputError: { borderColor: theme.danger },
  error: { color: theme.danger, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
});
