// ============================================================
// app/(tabs)/_layout.tsx — SuperRH
// ============================================================
import { Tabs } from 'expo-router';
import { Platform, TouchableOpacity, Alert } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

const TABS = [
  { name: 'index',         title: 'Dashboard',  icon: 'grid',           adminOnly: false },
  { name: 'colaboradores', title: 'Equipe',      icon: 'people',         adminOnly: false },
  { name: 'agenda',        title: 'Agenda',      icon: 'calendar',       adminOnly: false },
  { name: 'ferias',        title: 'Férias',      icon: 'umbrella',       adminOnly: false },
  { name: 'avisos',        title: 'Avisos',      icon: 'megaphone',      adminOnly: false },
  { name: 'ia',            title: 'Assistente',  icon: 'sparkles',       adminOnly: false },
  { name: 'admin',         title: 'Admin',       icon: 'shield-checkmark', adminOnly: true },
] as const;

export default function TabLayout() {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

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
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: Platform.OS === 'ios' ? 80 : 60,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.gold,
        headerTitleStyle: {
          fontWeight: '700', color: theme.white,
          letterSpacing: 0.5, fontSize: 16,
        },
        headerShadowVisible: false,
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={22} color={theme.textMuted} />
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
            href: tab.adminOnly && !isSuperAdmin ? null : undefined,
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
