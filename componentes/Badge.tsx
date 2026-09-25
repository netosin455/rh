import { StyleSheet, Text, View } from 'react-native';
import { radius, theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

type BadgeProps = { label: string; tone?: 'gold' | 'success' | 'danger' | 'info' | 'muted' };

const tones = {
  gold: { backgroundColor: theme.goldPale, color: theme.gold },
  success: { backgroundColor: theme.successBackground, color: theme.success },
  danger: { backgroundColor: theme.dangerBackground, color: theme.danger },
  info: { backgroundColor: theme.infoBackground, color: theme.info },
  muted: { backgroundColor: theme.bg, color: theme.textMuted },
} as const;

export function Badge({ label, tone = 'muted' }: BadgeProps) {
  return <View style={[styles.badge, { backgroundColor: tones[tone].backgroundColor }]}><Text style={[styles.text, { color: tones[tone].color }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.3 },
});
