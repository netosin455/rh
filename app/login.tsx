import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Linking, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contextos/Autenticacao';
import { Button } from '../componentes/Button';
import { Card } from '../componentes/Card';
import { Input } from '../componentes/Input';
import { theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width > 768;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';
  const GOOGLE_SSO_ENABLED = !!process.env.EXPO_PUBLIC_GOOGLE_SSO;

  function handleGoogleLogin() {
    const url = API_URL + '/api/auth/google';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      Linking.openURL(url);
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError('Preencha usuário e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={loginStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={loginStyles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={loginStyles.shell}>
          <View style={loginStyles.halo} pointerEvents="none" />
          <View style={[loginStyles.nav, isWide && loginStyles.navWide]}>
            <View>
              <Text style={loginStyles.brand}>SuperRH</Text>
              <Text style={loginStyles.brandSub}>GESTÃO DE PESSOAS</Text>
            </View>
          </View>

          <View style={loginStyles.content}>
            <Card style={loginStyles.card}>
              <Text style={loginStyles.formEyebrow}>BEM-VINDO</Text>
              <Text style={loginStyles.formTitle}>Entre no SuperRH</Text>
              <Text style={loginStyles.formSubtitle}>Use suas credenciais para continuar.</Text>

              {error ? (
                <View style={loginStyles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
                  <Text style={loginStyles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={loginStyles.fields}>
                <Input
                  label="Usuário"
                  placeholder="seu.usuario"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  returnKeyType="next"
                />
                <Input
                  label="Senha"
                  placeholder="Digite sua senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  rightAccessory={
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                      onPress={() => setShowPass(value => !value)}
                      style={loginStyles.eyeButton}
                    >
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  }
                />
              </View>

              <Button label="Entrar na plataforma" onPress={handleLogin} loading={loading} style={loginStyles.submit} />
              {GOOGLE_SSO_ENABLED ? (
                <View style={loginStyles.sso}>
                  <View style={loginStyles.divider}><View style={loginStyles.line} /><Text style={loginStyles.dividerText}>ou</Text><View style={loginStyles.line} /></View>
                  <Button label="Entrar com Google" icon="logo-google" variant="secondary" onPress={handleGoogleLogin} />
                </View>
              ) : null}
            </Card>
          </View>
          <Text style={loginStyles.footer}>© 2026 SuperRH · Plataforma de Gestão Jurídica e RH</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const loginStyles = StyleSheet.create({
  root: { backgroundColor: theme.bg, flex: 1 },
  scroll: { flexGrow: 1 },
  shell: { flex: 1, justifyContent: 'space-between', minHeight: '100%', overflow: 'hidden', paddingBottom: 24 },
  halo: { backgroundColor: theme.goldPale, borderRadius: 320, height: 460, opacity: 0.62, position: 'absolute', right: -220, top: -250, width: 460 },
  nav: { borderBottomColor: theme.border, borderBottomWidth: 1, paddingHorizontal: 24, paddingVertical: 20 },
  navWide: { paddingHorizontal: 64 },
  brand: { color: theme.textPrimary, fontFamily: fonts.display, fontSize: 30, lineHeight: 30 },
  brandSub: { color: theme.goldDeep, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 3 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  card: { alignSelf: 'center', maxWidth: 410, padding: 28, width: '100%' },
  formEyebrow: { color: theme.goldDeep, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2 },
  formTitle: { color: theme.textPrimary, fontFamily: fonts.display, fontSize: 34, lineHeight: 38, marginTop: 5 },
  formSubtitle: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
  fields: { gap: 14, marginTop: 24 },
  eyeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  errorBox: { alignItems: 'center', backgroundColor: theme.dangerBackground, borderRadius: 8, flexDirection: 'row', gap: 8, marginTop: 18, padding: 10 },
  errorText: { color: theme.danger, flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  submit: { marginTop: 22 },
  sso: { marginTop: 20 },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 14 },
  line: { backgroundColor: theme.border, flex: 1, height: 1 },
  dividerText: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 12 },
  footer: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 24, paddingTop: 24, textAlign: 'center' },
});
