import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = 'folder-open-outline', title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}><Ionicons name={icon} size={28} color={theme.gold} /></View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  icon: { alignItems: 'center', backgroundColor: theme.goldPale, borderRadius: 24, height: 48, justifyContent: 'center', marginBottom: 12, width: 48 },
  title: { color: theme.textPrimary, fontFamily: fonts.semibold, fontSize: 16, textAlign: 'center' },
  description: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 300, textAlign: 'center' },
  action: { marginTop: 16 },
});
