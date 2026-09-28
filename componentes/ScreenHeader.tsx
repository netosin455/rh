import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { espaco } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

// Sem "eyebrow"/kicker acima do título de propósito: é um enfeite que nunca ajuda a
// hierarquia — o título carrega o próprio peso. Contexto extra vai no subtítulo.
type ScreenHeaderProps = { title: string; subtitle?: string; action?: ReactNode };

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.lg, justifyContent: 'space-between' },
  copy: { flex: 1 },
  title: { ...tipografia.display, color: theme.texto.primario },
  subtitle: { ...tipografia.corpo, color: theme.texto.discreto, marginTop: espaco.xs },
  action: { flexShrink: 0 },
});
