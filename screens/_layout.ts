// ============================================================
// app/(tabs)/_layout.tsx — SuperRH
// ============================================================
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme';

const TABS = [
  { name: 'index',          title: 'Dashboard',     icon: 'grid' },
  { name: 'colaboradores',  title: 'Equipe',         icon: 'people' },
  { name: 'processos',      title: 'Processos',      icon: 'briefcase' },
  { name: 'agenda',         title: 'Agenda',         icon: 'calendar' },
  { name: 'ferias',         title: 'Férias',         icon: 'umbrella' },
  { name: 'ia',             title: 'Assistente',     icon: 'sparkles' },
] as const;

export default function TabLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'rh';

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
          fontWeight: '700',
          color: theme.white,
          letterSpacing: 0.5,
          fontSize: 16,
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

// ============================================================
// utils/dateUtils.ts — SuperRH
// ============================================================
export function getTodayString(): string {
  const d = new Date();
  return toDateString(d);
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' });
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayString();
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
