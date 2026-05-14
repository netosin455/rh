// ============================================================
// app/(tabs)/_layout.tsx — SuperRH
// ============================================================
import { Tabs } from 'expo-router';
import { Platform, TouchableOpacity, Alert } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

// roles: null = visível para todos | string[] = visível apenas para esses roles
const TABS = [
  { name: 'index',         title: 'Dashboard',  icon: 'grid',             roles: null },
  { name: 'colaboradores', title: 'Equipe',      icon: 'people',           roles: null },
  { name: 'analytics',     title: 'Analytics',  icon: 'bar-chart',        roles: ['rh', 'admin', 'super_admin', 'adm'] },
  { name: 'agenda',        title: 'Agenda',      icon: 'calendar',         roles: null },
  { name: 'ferias',        title: 'Férias',      icon: 'umbrella',         roles: null },
  { name: 'avisos',        title: 'Avisos',      icon: 'megaphone',        roles: null },
  { name: 'ia',            title: 'Assistente',  icon: 'sparkles',         roles: null },
  { name: 'admin',         title: 'Admin',       icon: 'shield-checkmark', roles: ['super_admin'] },
] as const;

export default function TabLayout() {
  const { user, logout } = useAuth();

  function handleLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da conta?')) logout();
    } else {
      Alert.alert('Sair', 'Deseja sair da conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: logout },
      ]);
    }
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   theme.gold,
        tabBarInactiveTintColor: '#555250',
        tabBarStyle: {
          backgroundColor: '#0C0E12',
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: Platform.OS === 'ios' ? 80 : 62,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
        headerStyle: { backgroundColor: '#0C0E12', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' } as any,
        headerTintColor: theme.gold,
        headerTitleStyle: {
          fontWeight: '800', color: theme.white,
          letterSpacing: 0.5, fontSize: 16,
        },
        headerShadowVisible: false,
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={22} color={theme.gold} />
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
            href: tab.roles && !tab.roles.includes(user?.role as any) ? null : undefined,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={(focused ? tab.icon : `${tab.icon}-outline`) as any}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
