// ============================================================
// app/(tabs)/_layout.tsx — SuperRH
// ============================================================
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

const TABS = [
  { name: 'index',         title: 'Dashboard',  icon: 'grid' },
  { name: 'colaboradores', title: 'Equipe',      icon: 'people' },
  { name: 'agenda',        title: 'Agenda',      icon: 'calendar' },
  { name: 'ferias',        title: 'Férias',      icon: 'umbrella' },
  { name: 'ia',            title: 'Assistente',  icon: 'sparkles' },
] as const;

export default function TabLayout() {
  const { user } = useAuth();

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
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
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
