import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card } from '../../componentes/Card';
import { ListRow } from '../../componentes/ListRow';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { useAuth } from '../../contextos/Autenticacao';
import { cores } from '../../estilo/cores';
import { espaco, raio, tamanho } from '../../estilo/espaco';
import { MOBILE_PRIMARY_KEYS, SHELL_GROUPS, canAccessNavigation } from '../../helpers/shellNav';

export default function MaisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const groups = SHELL_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        !MOBILE_PRIMARY_KEYS.has(item.key) && canAccessNavigation(item.roles, user?.role)
      )),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <ScreenHeader title="Mais opções" subtitle="Módulos organizados por área de trabalho." />
      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          <Card padded={false} style={styles.groupCard}>
            {group.items.map((item) => (
              <ListRow
                accessibilityLabel={`Abrir ${item.title}`}
                key={item.key}
                leading={
                  <View style={styles.icon}>
                    <Ionicons color={cores.accent.douradoProfundo} name={item.icon} size={tamanho.iconeMedio} />
                  </View>
                }
                onPress={() => router.navigate(item.href as never)}
                title={item.title}
                trailing={<Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} />}
              />
            ))}
          </Card>
        </Section>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.xxxl, padding: espaco.lg, paddingBottom: espaco.tela },
  groupCard: { overflow: 'hidden' },
  icon: { alignItems: 'center', backgroundColor: cores.accent.superficie, borderRadius: raio.controle, height: tamanho.avatarMedio, justifyContent: 'center', width: tamanho.avatarMedio },
});
