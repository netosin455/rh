// ============================================================
// app/_layout.tsx — SuperRH · Root Layout
// ============================================================

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contextos/Autenticacao';

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isPublic = segments[0] === 'login' || segments[0] === 'responder' || segments.length === 0;
    if (!user && !isPublic) {
      router.replace('/login');
    } else if (user && (segments[0] === 'login' || segments.length === 0)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="colaborador/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="pesquisas/index" options={{ headerShown: false }} />
      <Stack.Screen name="pesquisas/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="responder/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGuard />
    </AuthProvider>
  );
}
