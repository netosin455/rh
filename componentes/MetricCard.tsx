import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { theme } from '../estilo/cores';
import { espaco, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  indicator?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Métrica leve: hierarquia por tipografia, não por sombra ou caixa pesada. */
export function MetricCard({ label, value, detail, indicator, onPress, accessibilityLabel }: MetricCardProps) {
  const summary = accessibilityLabel ?? [label, String(value), detail].filter(Boolean).join('. ');

  return (
    <Card accessibilityLabel={summary} onPress={onPress} padded>
      <View accessibilityRole="text" accessibilityLabel={summary} style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {indicator}
        </View>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: espaco.xs, minHeight: tamanho.toqueMinimo },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, justifyContent: 'space-between' },
  label: { ...tipografia.legenda, color: theme.texto.discreto },
  value: { ...tipografia.titulo, color: theme.texto.primario },
  detail: { ...tipografia.legenda, color: theme.texto.secundario },
});
