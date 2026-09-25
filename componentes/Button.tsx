import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { radius, theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

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
  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? theme.onGold : theme.gold} />
  ) : (
    <>
      {icon ? <Ionicons name={icon} size={18} color={variant === 'primary' ? theme.onGold : theme.gold} /> : null}
      {label ? <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text> : null}
      {children}
    </>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled || loading}
        onPress={onPress}
        activeOpacity={0.86}
        style={[styles.touch, style, (disabled || loading) && styles.disabled]}
      >
        <LinearGradient colors={[theme.gold, theme.goldLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.touch,
        styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        style,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: 44, borderRadius: radius.sm, overflow: 'hidden' },
  primary: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondary: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.borderStrong },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { borderColor: theme.danger, backgroundColor: theme.dangerBackground },
  disabled: { opacity: 0.55 },
  label: { fontFamily: fonts.bold, fontSize: 14 },
  primaryLabel: { color: theme.onGold },
  secondaryLabel: { color: theme.textPrimary },
});
