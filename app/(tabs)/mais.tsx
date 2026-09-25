import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../componentes/Card';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { useAuth } from '../../contextos/Autenticacao';
import { radius, theme } from '../../estilo/cores';
import { fonts } from '../../estilo/tipografia';

const LINKS = [
  { title: 'Analytics', description: 'Indicadores e tendências', icon: 'bar-chart-outline', route: '/(tabs)/analytics', roles: ['rh', 'admin', 'super_admin', 'adm'] },
  { title: 'Avisos', description: 'Comunicados da equipe', icon: 'megaphone-outline', route: '/(tabs)/avisos' },
  { title: 'Kudos', description: 'Reconhecimentos', icon: 'trophy-outline', route: '/(tabs)/reconhecimentos' },
  { title: 'Assistente', description: 'Apoio inteligente', icon: 'sparkles-outline', route: '/(tabs)/ia' },
  { title: 'Administração', description: 'Configurações do sistema', icon: 'shield-checkmark-outline', route: '/(tabs)/admin', roles: ['super_admin'] },
] as const;

export default function MaisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const links = LINKS.filter(link => !link.roles || link.roles.includes(user?.role as never));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="Navegação" title="Mais opções" subtitle="Acesse os módulos complementares do SuperRH." />
      <Card style={styles.card} padded={false}>
        {links.map((link, index) => (
          <TouchableOpacity
            key={link.route}
            accessibilityRole="button"
            accessibilityLabel={'Abrir ' + link.title}
            onPress={() => router.push(link.route as never)}
            style={[styles.link, index < links.length - 1 && styles.linkBorder]}
          >
            <View style={styles.icon}><Ionicons name={link.icon as never} size={20} color={theme.gold} /></View>
            <View style={styles.copy}>
              <Text style={styles.title}>{link.title}</Text>
              <Text style={styles.description}>{link.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: theme.bg, flex: 1 },
  content: { gap: 20, padding: 16 },
  card: { overflow: 'hidden' },
  link: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 68, paddingHorizontal: 14, paddingVertical: 12 },
  linkBorder: { borderBottomColor: theme.border, borderBottomWidth: 1 },
  icon: { alignItems: 'center', backgroundColor: theme.goldPale, borderRadius: radius.sm, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1 },
  title: { color: theme.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  description: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
