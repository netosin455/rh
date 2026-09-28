import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BrandMark } from '../../componentes/BrandMark';
import { Button } from '../../componentes/Button';
import { countPendentes } from '../../conexoes/ausencias';
import { buscarNotificacoes } from '../../conexoes/notificacoes';
import { useAuth } from '../../contextos/Autenticacao';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { useMotion } from '../../estilo/movimento';
import { tipografia } from '../../estilo/tipografia';
import { confirmAction } from '../../helpers/confirm';

type TabName = 'index' | 'colaboradores' | 'ferias' | 'agenda' | 'avisos' | 'reconhecimentos' | 'analytics' | 'ia' | 'admin' | 'mais';

export type ShellNavigationItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tabName?: Exclude<TabName, 'mais'>;
  roles: readonly string[] | null;
};

type ShellNavigationGroup = {
  title: string;
  items: readonly ShellNavigationItem[];
};

export const SHELL_GROUPS: readonly ShellNavigationGroup[] = [
  {
    title: 'Visão geral',
    items: [{ key: 'dashboard', title: 'Dashboard', icon: 'grid', href: '/(tabs)', tabName: 'index', roles: null }],
  },
  {
    title: 'Pessoas',
    items: [
      { key: 'equipe', title: 'Equipe', icon: 'people', href: '/(tabs)/colaboradores', tabName: 'colaboradores', roles: null },
      { key: 'onboarding', title: 'Onboarding', icon: 'rocket', href: '/onboarding', roles: null },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { key: 'ferias', title: 'Férias', icon: 'umbrella', href: '/(tabs)/ferias', tabName: 'ferias', roles: null },
      { key: 'agenda', title: 'Agenda', icon: 'calendar', href: '/(tabs)/agenda', tabName: 'agenda', roles: null },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { key: 'avisos', title: 'Avisos', icon: 'megaphone', href: '/(tabs)/avisos', tabName: 'avisos', roles: null },
      { key: 'reconhecimentos', title: 'Kudos', icon: 'trophy', href: '/(tabs)/reconhecimentos', tabName: 'reconhecimentos', roles: null },
      { key: 'pesquisas', title: 'Pesquisas', icon: 'stats-chart', href: '/pesquisas', roles: null },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { key: 'analytics', title: 'Analytics', icon: 'bar-chart', href: '/(tabs)/analytics', tabName: 'analytics', roles: ['rh', 'admin', 'super_admin', 'adm'] },
      { key: 'ia', title: 'Assistente', icon: 'sparkles', href: '/(tabs)/ia', tabName: 'ia', roles: null },
    ],
  },
  {
    title: 'Administração',
    items: [{ key: 'admin', title: 'Admin', icon: 'shield-checkmark', href: '/(tabs)/admin', tabName: 'admin', roles: ['super_admin'] }],
  },
];

export const MOBILE_PRIMARY_KEYS = new Set(['dashboard', 'equipe', 'ferias', 'agenda']);

const CAN_APPROVE = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];
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

export function canAccessNavigation(roles: readonly string[] | null, role: string | undefined) {
  return roles === null || roles.includes(role ?? '');
}

function tabTitle(name: string) {
  return TABS.find((tab) => tab.name === name)?.title ?? 'SuperRH';
}

type ItemLayout = { height: number; y: number };

function SidebarItem({
  active,
  item,
  onLayout,
  onPress,
  pendingCount = 0,
}: {
  active: boolean;
  item: ShellNavigationItem;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  pendingCount?: number;
}) {
  const [focused, setFocused] = useState(false);
  const motion = useMotion();
  const hoverOpacity = useSharedValue(0);
  const icon = (active ? item.icon : `${item.icon}-outline`) as keyof typeof Ionicons.glyphMap;
  const hoverStyle = useAnimatedStyle(() => ({ opacity: hoverOpacity.value }));

  useEffect(() => {
    if (active) hoverOpacity.value = 0;
  }, [active, hoverOpacity]);

  function setHovering(hovered: boolean) {
    if (active) return;
    hoverOpacity.value = withTiming(hovered ? 1 : 0, {
      duration: motion.reduzMovimento ? motion.fadeCurto : 120,
      easing: hovered ? motion.entrada : motion.saida,
    });
  }

  return (
    <Pressable
      accessibilityLabel={`Abrir ${item.title}${pendingCount > 0 ? `, ${pendingCount} pendências` : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovering(true)}
      onHoverOut={() => setHovering(false)}
      onLayout={onLayout}
      onPress={onPress}
      style={[styles.sidebarItem, active && styles.sidebarItemActive, focused && styles.sidebarItemFocused]}
    >
      <Animated.View pointerEvents="none" style={[styles.sidebarItemHover, hoverStyle]} />
      <Ionicons color={active ? cores.sidebar.accent : cores.sidebar.textoInativo} name={icon} size={tamanho.iconeMedio} />
      <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{item.title}</Text>
      {pendingCount > 0 ? <View style={styles.sidebarPendingBadge}><Text style={styles.sidebarPendingBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text></View> : null}
    </Pressable>
  );
}

function WideSidebar({ state, pendentesCount }: BottomTabBarProps & { pendentesCount: number }) {
  const motion = useMotion();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [layouts, setLayouts] = useState<Record<string, ItemLayout>>({});
  const indicatorY = useSharedValue(0);
  const indicatorHeight = useSharedValue(tamanho.toqueMinimo);
  const indicatorOpacity = useSharedValue(0);
  const role = user?.role;
  const groups = useMemo(() => SHELL_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessNavigation(item.roles, role)) }))
    .filter((group) => group.items.length > 0), [role]);
  const activeTab = state.routes[state.index]?.name;
  const activeItem = groups.flatMap((group) => group.items).find((item) => (
    item.tabName ? item.tabName === activeTab : pathname.startsWith(item.href)
  ));
  const indicatorLayout = activeItem ? layouts[activeItem.key] : undefined;

  useEffect(() => {
    if (!indicatorLayout) return;

    if (motion.reduzMovimento) {
      indicatorY.value = indicatorLayout.y;
      indicatorHeight.value = indicatorLayout.height;
      indicatorOpacity.value = withTiming(1, { duration: motion.fadeCurto, easing: motion.entrada });
      return;
    }

    indicatorY.value = withTiming(indicatorLayout.y, { duration: motion.duracao('estrutural'), easing: motion.entrada });
    indicatorHeight.value = withTiming(indicatorLayout.height, { duration: motion.duracao('estrutural'), easing: motion.entrada });
    indicatorOpacity.value = withTiming(1, { duration: motion.duracao('fast'), easing: motion.entrada });
  }, [indicatorHeight, indicatorLayout, indicatorOpacity, indicatorY, motion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    height: indicatorHeight.value,
    opacity: indicatorOpacity.value,
    transform: [{ translateY: indicatorY.value }],
  }));

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}><BrandMark inverse /></View>
      <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
        <Animated.View pointerEvents="none" style={[styles.activeIndicator, indicatorStyle]} />
        {groups.map((group) => (
          <View key={group.title} style={styles.navGroup}>
            <Text accessibilityRole="header" style={styles.groupLabel}>{group.title}</Text>
            {group.items.map((item) => (
              <SidebarItem
                active={activeItem?.key === item.key}
                item={item}
                key={item.key}
                onLayout={(event) => {
                  const { height, y } = event.nativeEvent.layout;
                  setLayouts((previous) => previous[item.key]?.y === y && previous[item.key]?.height === height
                    ? previous
                    : { ...previous, [item.key]: { height, y } });
                }}
                onPress={() => router.navigate(item.href as never)}
                pendingCount={item.key === 'ferias' && CAN_APPROVE.includes(role ?? '') ? pendentesCount : 0}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Único ponto de acesso a notificações no shell (evita duplicar o sino em cada tela,
// como acontecia antes no Dashboard). O contador vem do TabLayout, mesma cadência do
// contador de férias pendentes.
function NotificationsButton({ style, unreadCount }: { style?: object; unreadCount: number }) {
  const router = useRouter();
  return (
    <View style={styles.notificationsWrap}>
      <Button
        accessibilityLabel={unreadCount > 0 ? `Abrir notificações, ${unreadCount} não lidas` : 'Abrir notificações'}
        icon="notifications-outline"
        onPress={() => router.navigate('/notificacoes' as never)}
        style={style}
        variant="ghost"
      />
      {unreadCount > 0 ? (
        <View style={styles.notificationsBadge}>
          <Text style={styles.notificationsBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </View>
  );
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
  const [pendentesCount, setPendentesCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const isWideWeb = Platform.OS === 'web' && width >= 960;

  useEffect(() => {
    if (!CAN_APPROVE.includes(user?.role ?? '')) return;
    countPendentes().then(setPendentesCount).catch(() => {});
    const interval = setInterval(() => {
      countPendentes().then(setPendentesCount).catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    buscarNotificacoes().then((result) => setUnreadCount(result.unread)).catch(() => {});
    const interval = setInterval(() => {
      buscarNotificacoes().then((result) => setUnreadCount(result.unread)).catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  function handleLogout() {
    confirmAction('Sair', 'Deseja sair da conta?', logout);
  }

  return (
    <Tabs
      tabBar={isWideWeb ? (props) => <WideSidebar {...props} pendentesCount={pendentesCount} /> : undefined}
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
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{pendentesCount > 9 ? '9+' : pendentesCount}</Text>
                    </View>
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
  sidebar: { backgroundColor: cores.sidebar.superficie, borderRightColor: cores.accent.borda, borderRightWidth: borda.fina, width: espaco.tela * 4 },
  brand: { borderBottomColor: cores.accent.borda, borderBottomWidth: borda.fina, minHeight: tamanho.toqueMinimo + espaco.xxl, justifyContent: 'center', paddingHorizontal: espaco.xl },
  sidebarContent: { paddingBottom: espaco.xxl, paddingHorizontal: espaco.sm, paddingTop: espaco.lg, position: 'relative' },
  activeIndicator: { backgroundColor: cores.sidebar.accent, borderRadius: raio.pill, left: espaco.xs, position: 'absolute', top: espaco.zero, width: tamanho.indicador },
  navGroup: { gap: espaco.xs, marginBottom: espaco.xl },
  groupLabel: { ...tipografia.rotulo, color: cores.sidebar.textoInativo, paddingHorizontal: espaco.md, textTransform: 'uppercase' },
  sidebarItem: { alignItems: 'center', borderColor: cores.superficie.transparente, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, overflow: 'hidden', paddingHorizontal: espaco.md, position: 'relative' },
  sidebarItemActive: { backgroundColor: cores.sidebar.itemAtivo },
  sidebarItemHover: { ...StyleSheet.absoluteFillObject, backgroundColor: cores.sidebar.hover },
  sidebarItemFocused: { borderColor: cores.foco.anel, borderWidth: borda.foco },
  sidebarLabel: { ...tipografia.corpoForte, color: cores.sidebar.textoInativo, flex: 1 },
  sidebarLabelActive: { color: cores.sidebar.texto },
  sidebarPendingBadge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro },
  sidebarPendingBadgeText: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
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
