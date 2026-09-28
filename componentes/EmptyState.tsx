import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { espaco, largura, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = 'folder-open-outline', title, description, action }: EmptyStateProps) {
  return (
    <View accessibilityRole="text" accessibilityLabel={[title, description].filter(Boolean).join('. ')} style={styles.container}>
      <View style={styles.icon}><Ionicons name={icon} size={tamanho.iconeGrande} color={theme.accent.douradoProfundo} /></View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: espaco.xxl, paddingVertical: espaco.gigante },
  icon: { alignItems: 'center', backgroundColor: theme.accent.superficie, borderRadius: raio.pill, height: espaco.secao, justifyContent: 'center', marginBottom: espaco.md, width: espaco.secao },
  title: { ...tipografia.subtitulo, color: theme.texto.primario, textAlign: 'center' },
  description: { ...tipografia.corpo, color: theme.texto.discreto, marginTop: espaco.xs, maxWidth: largura.textoCurto, textAlign: 'center' },
  action: { marginTop: espaco.lg },
});
