// ============================================================
// app/(tabs)/_layout.tsx — SuperRH
// ============================================================
import { Tabs } from 'expo-router';
import { Platform, TouchableOpacity, View, Text, StyleSheet, useWindowDimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';
import { fonts } from '../../estilo/tipografia';
import { useEffect, useState } from 'react';
import { countPendentes } from '../../conexoes/ausencias';
import { confirmAction } from '../../helpers/confirm';

// roles: null = visível para todos | string[] = visível apenas para esses roles
const TABS = [
  { name: 'index',         title: 'Dashboard',  icon: 'grid',             roles: null },
  { name: 'colaboradores', title: 'Equipe',      icon: 'people',           roles: null },
  { name: 'analytics',     title: 'Analytics',  icon: 'bar-chart',        roles: ['rh', 'admin', 'super_admin', 'adm'] },
  { name: 'agenda',        title: 'Agenda',      icon: 'calendar',         roles: null },
  { name: 'ferias',        title: 'Férias',      icon: 'umbrella',         roles: null },
  { name: 'avisos',        title: 'Avisos',      icon: 'megaphone',        roles: null },
  { name: 'reconhecimentos', title: 'Kudos',     icon: 'trophy',           roles: null },
  { name: 'ia',            title: 'Assistente',  icon: 'sparkles',         roles: null },
  { name: 'admin',         title: 'Admin',       icon: 'shield-checkmark', roles: ['super_admin'] },
  { name: 'mais',          title: 'Mais',        icon: 'ellipsis-horizontal-circle', roles: null },
] as const;

const CAN_APPROVE = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];
const MOBILE_TABS = new Set(['index', 'colaboradores', 'agenda', 'ferias', 'mais']);

export default function TabLayout() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [pendentesCount, setPendentesCount] = useState(0);
  const isWideWeb = Platform.OS === 'web' && width >= 960;

  useEffect(() => {
    if (!CAN_APPROVE.includes(user?.role ?? '')) return;
    countPendentes().then(setPendentesCount).catch(() => {});
    // Atualizar a cada 2 minutos enquanto o app está aberto
    const interval = setInterval(() => {
      countPendentes().then(setPendentesCount).catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  function handleLogout() {
    confirmAction('Sair', 'Deseja sair da conta?', logout);
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   theme.gold,
        tabBarInactiveTintColor: theme.sidebarMuted,
        tabBarPosition: isWideWeb ? 'left' : 'bottom',
        tabBarStyle: isWideWeb ? styles.sidebar : styles.mobileTabs,
        tabBarItemStyle: isWideWeb ? styles.sidebarItem : styles.mobileItem,
        tabBarLabelStyle: isWideWeb ? styles.sidebarLabel : styles.mobileLabel,
        headerStyle: styles.header,
        headerTintColor: theme.textPrimary,
        headerTitleStyle: {
          fontFamily: fonts.display, color: theme.textPrimary,
          fontSize: 24,
        },
        headerShadowVisible: false,
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sair da conta" onPress={handleLogout} style={styles.logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.gold} />
          </TouchableOpacity>
        ),
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            href: (tab.roles && !tab.roles.includes(user?.role as any))
              || (!isWideWeb && !MOBILE_TABS.has(tab.name))
              || (isWideWeb && tab.name === 'mais')
              ? null
              : undefined,
            tabBarIcon: ({ color, focused }) => (
              <View>
                <Ionicons
                  name={(focused ? tab.icon : `${tab.icon}-outline`) as any}
                  size={22}
                  color={color}
                />
                {tab.name === 'ferias' && pendentesCount > 0 && CAN_APPROVE.includes(user?.role ?? '') && (
                  <View style={badgeStyles.badge}>
                    <Text style={badgeStyles.text}>{pendentesCount > 9 ? '9+' : pendentesCount}</Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -8,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: theme.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
  },
  text: { fontFamily: fonts.bold, fontSize: 10, color: theme.card },
});

const styles = StyleSheet.create({
  header: { backgroundColor: theme.card, borderBottomColor: theme.border, borderBottomWidth: 1 },
  logout: { alignItems: 'center', height: 44, justifyContent: 'center', marginRight: 12, width: 44 },
  sidebar: { backgroundColor: theme.sidebar, borderRightColor: 'rgba(184,151,58,0.18)', borderRightWidth: 1, borderTopWidth: 0, paddingHorizontal: 10, paddingTop: 24, width: 232 },
  sidebarItem: { borderRadius: 8, marginBottom: 4, minHeight: 46 },
  sidebarLabel: { fontFamily: fonts.medium, fontSize: 12, marginTop: -2 },
  mobileTabs: { backgroundColor: theme.card, borderTopColor: theme.border, borderTopWidth: 1, height: Platform.OS === 'ios' ? 82 : 66, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
  mobileItem: { minHeight: 48 },
  mobileLabel: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 1 },
});
