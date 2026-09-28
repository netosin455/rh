import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { espaco, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type BrandMarkProps = {
  inverse?: boolean;
  label?: string;
  /** 'grande' é o único momento de destaque da marca (login); em toda outra tela use o padrão. */
  size?: 'padrao' | 'grande';
};

/** A única instância de Cormorant no sistema: a assinatura da marca. */
export function BrandMark({ inverse = false, label = 'SuperRH', size = 'padrao' }: BrandMarkProps) {
  const grande = size === 'grande';
  return (
    <View accessibilityRole="header" accessibilityLabel={label} style={[styles.brand, grande && styles.brandGrande]}>
      <View style={[styles.rule, grande && styles.ruleGrande, inverse && styles.ruleInverse]} />
      <Text style={[styles.wordmark, grande && styles.wordmarkGrande, inverse && styles.wordmarkInverse]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  brandGrande: { gap: espaco.md },
  rule: { backgroundColor: theme.accent.dourado, height: tamanho.regraMarca, width: espaco.xl },
  ruleGrande: { height: tamanho.regraMarca * 2, width: espaco.xxl },
  ruleInverse: { backgroundColor: theme.sidebarSemantica.accent },
  wordmark: { ...tipografia.marca, color: theme.accent.douradoProfundo },
  wordmarkGrande: { fontSize: 44, lineHeight: 48, letterSpacing: 0.2 },
  wordmarkInverse: { color: theme.sidebarSemantica.texto },
});
