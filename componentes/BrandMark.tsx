import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { espaco, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type BrandMarkProps = {
  inverse?: boolean;
  label?: string;
};

/** A única instância de Cormorant no sistema: a assinatura da marca. */
export function BrandMark({ inverse = false, label = 'SuperRH' }: BrandMarkProps) {
  return (
    <View accessibilityRole="header" accessibilityLabel={label} style={styles.brand}>
      <View style={[styles.rule, inverse && styles.ruleInverse]} />
      <Text style={[styles.wordmark, inverse && styles.wordmarkInverse]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  rule: { backgroundColor: theme.accent.dourado, height: tamanho.regraMarca, width: espaco.xl },
  ruleInverse: { backgroundColor: theme.sidebarSemantica.accent },
  wordmark: { ...tipografia.marca, color: theme.accent.douradoProfundo },
  wordmarkInverse: { color: theme.sidebarSemantica.texto },
});
