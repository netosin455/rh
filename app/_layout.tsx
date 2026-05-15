// ============================================================
// app/_layout.tsx — SuperRH · Root Layout
// ============================================================

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../contextos/Autenticacao';

function readSSOParams(): { sso_token?: string; sso_error?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  return { sso_token: sp.get('sso_token') ?? undefined, sso_error: sp.get('sso_error') ?? undefined };
}

function AuthGuard() {
  const { user, loading, loginWithToken } = useAuth();
  const segments  = useSegments();
  const router    = useRouter();
  const ssoHandled = useRef(false);

  // Detecta token / erro SSO Google na URL (/?sso_token=... ou /?sso_error=...)
  useEffect(() => {
    if (loading || ssoHandled.current) return;
    const { sso_token, sso_error } = readSSOParams();

    if (sso_error) {
      ssoHandled.current = true;
      window.alert(`Erro ao entrar com Google: ${decodeURIComponent(sso_error)}`);
      if (Platform.OS === 'web') window.history.replaceState({}, '', '/login');
      router.replace('/login');
      return;
    }

    if (sso_token) {
      ssoHandled.current = true;
      loginWithToken(sso_token)
        .then(() => {
          if (Platform.OS === 'web') window.history.replaceState({}, '', '/');
          router.replace('/(tabs)');
        })
        .catch(() => router.replace('/login'));
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (ssoHandled.current) return;
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
