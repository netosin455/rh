import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { espaco } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type SectionProps = PropsWithChildren<{
  title?: string;
  description?: string;
  action?: ReactNode;
}>;

export function Section({ title, description, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      {title || description || action ? (
        <View style={styles.header}>
          <View style={styles.copy}>
            {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: espaco.md },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.lg, justifyContent: 'space-between' },
  copy: { flex: 1 },
  title: { ...tipografia.subtitulo, color: theme.texto.primario },
  description: { ...tipografia.corpo, color: theme.texto.discreto, marginTop: espaco.xs },
  action: { flexShrink: 0 },
});
