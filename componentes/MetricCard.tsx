import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { NumeroAnimado } from './NumeroAnimado';
import { FormatoContagem, formatarContagem } from '../helpers/contagem';
import { theme } from '../estilo/cores';
import { espaco, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type MetricCardProps = {
  label: string;
  value: string | number;
  /** Valor numérico que conta até o final (F3). Padrão: o próprio `value` quando ele já é número. */
  numero?: number;
  formato?: FormatoContagem;
  detail?: string;
  indicator?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Quando o cartão é um filtro: true = filtro ativo (destaque + aria-pressed). Ignorado sem onPress. */
  selecionado?: boolean;
};

/** Métrica leve: hierarquia por tipografia, não por sombra ou caixa pesada. */
export function MetricCard({ label, value, numero, formato, detail, indicator, onPress, accessibilityLabel, selecionado }: MetricCardProps) {
  const numeroFinal = numero ?? (typeof value === 'number' ? value : undefined);
  // O rótulo para leitor de tela já nasce com o valor FINAL (o texto que conta é escondido dele).
  const textoFinal = numeroFinal !== undefined ? formatarContagem(numeroFinal, formato) : String(value);
  const summary = accessibilityLabel ?? [label, textoFinal, detail].filter(Boolean).join('. ');

  return (
    <Card
      accessibilityLabel={summary}
      onPress={onPress}
      padded
      style={onPress && selecionado ? styles.selecionado : undefined}
      {...(onPress && selecionado !== undefined ? { 'aria-pressed': selecionado, accessibilityState: { selected: selecionado } } : {})}
    >
      <View accessibilityRole="text" accessibilityLabel={summary} style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.label}>{label}</Text>
          {indicator}
        </View>
        {numeroFinal !== undefined ? <NumeroAnimado formato={formato} style={styles.value} valor={numeroFinal} /> : <Text style={styles.value}>{value}</Text>}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // A borda de destaque é a moldura que desliza (SeletorDeslizante); aqui só o fundo muda, sem alterar a espessura (nada se mexe).
  selecionado: { backgroundColor: theme.accent.superficie, borderColor: theme.accent.dourado },
  content: { gap: espaco.xs, minHeight: tamanho.toqueMinimo },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, justifyContent: 'space-between' },
  label: { ...tipografia.legenda, color: theme.texto.discreto },
  value: { ...tipografia.titulo, color: theme.texto.primario },
  detail: { ...tipografia.legenda, color: theme.texto.secundario },
});
