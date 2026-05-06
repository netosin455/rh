// ============================================================
// app/_layout.tsx — SuperRH · Root Layout
// ============================================================

import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../../contextos/Autenticacao';

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login' || segments.length === 0;
    const inTabs  = segments[0] === '(tabs)';
    if (!user && !onLogin) {
      router.replace('/login');
    } else if (user && onLogin) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGuard />
    </AuthProvider>
  );
}
