import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BadgeContador } from '../../componentes/BadgeContador';
import { BotaoSino } from '../../componentes/BotaoSino';
import { Button } from '../../componentes/Button';
import { EntradaTela } from '../../componentes/EntradaTela';
import { useAuth } from '../../contextos/Autenticacao';
import { useContadoresShell } from '../../contextos/Contadores';
import { usarSubida } from '../../contextos/usarSubida';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { confirmAction } from '../../helpers/confirm';
import { CAN_APPROVE, SHELL_GROUPS, ShellNavigationItem, TabName, canAccessNavigation } from '../../helpers/shellNav';

const MOBILE_TAB_NAMES = new Set<TabName>(['index', 'colaboradores', 'ferias', 'agenda', 'mais']);

type TabDefinition = {
  name: TabName;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles: readonly string[] | null;
};

function isTabItem(item: ShellNavigationItem): item is ShellNavigationItem & { tabName: Exclude<TabName, 'mais'> } {
  return item.tabName !== undefined;
}

const TABS: readonly TabDefinition[] = [
  ...SHELL_GROUPS.flatMap((group) => group.items.filter(isTabItem).map((item) => ({
    name: item.tabName,
    title: item.title,
    icon: item.icon,
    roles: item.roles,
  }))),
  { name: 'mais', title: 'Mais', icon: 'ellipsis-horizontal-circle', roles: null },
];

function tabTitle(name: string) {
  return TABS.find((tab) => tab.name === name)?.title ?? 'SuperRH';
}

// Único ponto de acesso a notificações no shell (evita duplicar o sino em cada tela,
// como acontecia antes no Dashboard). O contador vem do TabLayout, mesma cadência do
// contador de férias pendentes.
function NotificationsButton({ style, unreadCount }: { style?: object; unreadCount: number }) {
  const router = useRouter();
  const { naoLidasPronto } = useContadoresShell();
  return <BotaoSino naoLidas={unreadCount} onPress={() => router.navigate('/notificacoes' as never)} pronto={naoLidasPronto} style={style} />;
}

function WideTopbar({ onLogout, title, unreadCount }: { onLogout: () => void; title: string; unreadCount: number }) {
  return (
    <View style={styles.topbar}>
      <Text accessibilityRole="header" style={styles.topbarTitle}>{title}</Text>
      <View style={styles.topbarActions}>
        <NotificationsButton unreadCount={unreadCount} />
        <Button accessibilityLabel="Sair da conta" icon="log-out-outline" onPress={onLogout} variant="ghost" />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const { pendentes: pendentesCount, naoLidas: unreadCount, pendentesPronto } = useContadoresShell();
  // O badge de pendências de Férias dá o "pop" quando o número muda (F4), nunca na 1ª leitura.
  const pulsoPendentes = usarSubida(pendentesCount, pendentesPronto, false);
  const isWideWeb = Platform.OS === 'web' && width >= 960;

  function handleLogout() {
    confirmAction('Sair', 'Deseja sair da conta?', logout);
  }

  return (
    <Tabs
      screenLayout={({ route, navigation, children }) => <EntradaTela navigation={navigation} nomeRota={`tabs/${route.name}`}>{children}</EntradaTela>}
      // Em web larga a sidebar vive no layout raiz (ShellSidebar); aqui a tabBar não renderiza nada.
      tabBar={isWideWeb ? () => null : undefined}
      screenOptions={({ route }) => ({
        header: isWideWeb ? () => <WideTopbar onLogout={handleLogout} title={tabTitle(route.name)} unreadCount={unreadCount} /> : undefined,
        headerShadowVisible: false,
        headerStyle: styles.mobileHeader,
        headerTintColor: cores.texto.primario,
        headerTitleStyle: { ...tipografia.titulo, color: cores.texto.primario },
        headerRight: isWideWeb ? undefined : () => (
          <View style={styles.mobileHeaderActions}>
            <NotificationsButton style={styles.mobileHeaderButton} unreadCount={unreadCount} />
            <Button accessibilityLabel="Sair da conta" icon="log-out-outline" onPress={handleLogout} style={styles.mobileHeaderButton} variant="ghost" />
          </View>
        ),
        tabBarActiveTintColor: cores.texto.accentSobreClaro,
        tabBarInactiveTintColor: cores.texto.discreto,
        tabBarItemStyle: styles.mobileItem,
        tabBarLabelStyle: styles.mobileLabel,
        tabBarPosition: isWideWeb ? 'left' : 'bottom',
        tabBarStyle: styles.mobileTabs,
      })}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: !canAccessNavigation(tab.roles, user?.role)
              || (!isWideWeb && !MOBILE_TAB_NAMES.has(tab.name))
              || (isWideWeb && tab.name === 'mais')
              ? null
              : undefined,
            tabBarIcon: ({ color, focused }) => {
              const icon = (focused ? tab.icon : `${tab.icon}-outline`) as keyof typeof Ionicons.glyphMap;
              return (
                <View>
                  <Ionicons color={color} name={icon} size={tamanho.iconeMedio} />
                  {tab.name === 'ferias' && pendentesCount > 0 && CAN_APPROVE.includes(user?.role ?? '') ? (
                    <BadgeContador estilo={styles.pendingBadge} estiloTexto={styles.pendingBadgeText} pulso={pulsoPendentes} valor={pendentesCount} />
                  ) : null}
                </View>
              );
            },
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  topbar: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', height: tamanho.toqueMinimo + espaco.xxl, justifyContent: 'space-between', paddingHorizontal: espaco.xxl },
  topbarTitle: { ...tipografia.titulo, color: cores.texto.primario },
  topbarActions: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  notificationsWrap: { position: 'relative' },
  notificationsBadge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro, position: 'absolute', right: -espaco.xs, top: -espaco.xs },
  notificationsBadgeText: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
  mobileHeader: { backgroundColor: cores.superficie.elevada, borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina },
  mobileHeaderActions: { alignItems: 'center', flexDirection: 'row' },
  mobileHeaderButton: { marginRight: espaco.sm },
  mobileTabs: { backgroundColor: cores.superficie.elevada, borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, height: Platform.OS === 'ios' ? tamanho.toqueMinimo + espaco.xxxl : tamanho.toqueMinimo + espaco.xxl, paddingBottom: Platform.OS === 'ios' ? espaco.xl : espaco.sm },
  mobileItem: { minHeight: tamanho.toqueMinimo },
  mobileLabel: { ...tipografia.legenda, marginTop: espaco.micro },
  pendingBadge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro, position: 'absolute', right: -espaco.sm, top: -espaco.xs },
  pendingBadgeText: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
});
