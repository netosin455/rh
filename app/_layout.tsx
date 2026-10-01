// ============================================================
// app/_layout.tsx — SuperRH · Root Layout
// ============================================================

import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { AuthProvider, useAuth } from '../contextos/Autenticacao';
import { ContadoresProvider } from '../contextos/Contadores';
import { ToastProvider } from '../contextos/Toast';
import { ShellSidebar } from '../componentes/ShellSidebar';
import { deveMostrarShell } from '../helpers/navegacao';
import { PushProvider } from '../componentes/PushProvider';

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
  const pathname  = usePathname();
  const { width } = useWindowDimensions();
  // Sidebar persistente só na web larga, com usuário logado e fora das rotas públicas.
  const mostrarSidebar = Platform.OS === 'web' && width >= 960 && Boolean(user) && deveMostrarShell(pathname);

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
        .catch((e: unknown) => {
          // Sem token nem dados do usuário no log: só o motivo técnico.
          console.warn('[SSO] falha ao entrar com o token do Google:', e instanceof Error ? e.message : 'erro');
          router.replace('/login');
        });
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (ssoHandled.current) return;
    const rota: string[] = segments; // tipos gerados não conhecem rotas públicas como "feedback"
    const isPublic = rota[0] === 'login' || rota[0] === 'responder' || rota[0] === 'feedback' || rota.length === 0;
    if (!user && !isPublic) {
      router.replace('/login');
    } else if (user && (rota[0] === 'login' || rota.length === 0)) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  // A estrutura (row > sidebar? + Stack) é sempre a mesma: só a sidebar entra e sai, sem remontar o Stack.
  return (
    <View style={styles.raiz}>
      {mostrarSidebar ? <ShellSidebar /> : null}
      <View style={styles.conteudo}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="colaborador/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="pesquisas/index" options={{ headerShown: false }} />
      <Stack.Screen name="pesquisas/nova" options={{ headerShown: false }} />
      <Stack.Screen name="pesquisas/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="responder/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="feedbacks/index" options={{ headerShown: false }} />
      <Stack.Screen name="feedbacks/novo" options={{ headerShown: false }} />
      <Stack.Screen name="feedbacks/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="feedback/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
    </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, flexDirection: 'row' },
  conteudo: { flex: 1, minWidth: 0 },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    CormorantGaramond_600SemiBold,
  });
  // Fonte é acabamento visual: nunca pode travar o app. Com erro ou demora,
  // segue com a fonte do sistema em vez de ficar em tela branca.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 4000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (fontError) console.warn('[fonts] falha ao carregar fontes:', fontError.message);
  }, [fontError]);

  if (!fontsLoaded && !fontError && !fontTimeout) return null;

  return (
    <AuthProvider>
      <ToastProvider>
        <PushProvider>
          <ContadoresProvider>
            <StatusBar style="dark" />
            <AuthGuard />
          </ContadoresProvider>
        </PushProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
