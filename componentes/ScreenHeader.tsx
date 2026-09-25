import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

type ScreenHeaderProps = { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode };

export function ScreenHeader({ eyebrow, title, subtitle, action }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  copy: { flex: 1 },
  eyebrow: { color: theme.gold, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 3, textTransform: 'uppercase' },
  title: { color: theme.textPrimary, fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  subtitle: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
  action: { flexShrink: 0 },
});
