import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Linking, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contextos/Autenticacao';
import { Button } from '../componentes/Button';
import { theme } from '../estilo/cores';
import { fonts } from '../estilo/tipografia';

// Fundo escuro com halo dourado: mesma composição do login do Araujo Prev.
const BG_COLORS = ['#0F0F0F', '#1A1510', '#0D0D0D', '#1A1510'] as const;

type FieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoComplete?: 'username' | 'current-password';
  returnKeyType?: 'next' | 'go';
  onSubmitEditing?: () => void;
  autoCapitalize?: 'none';
  rightAccessory?: React.ReactNode;
  compact: boolean;
};

// Campo "clean": ícone + linha embaixo, sem caixa fechada. Foco muda ícone e linha para dourado.
function Field({ label, icon, rightAccessory, compact, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Ionicons name={icon} size={16} color={focused ? theme.gold : theme.textMuted} style={styles.inputIcon} />
        <TextInput
          {...input}
          accessibilityLabel={label}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, compact && styles.inputCompact, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        />
        {rightAccessory}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width <= 768;
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
    <View style={styles.root}>
      <LinearGradient colors={BG_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.haloTop} pointerEvents="none" />
      <View style={styles.haloLeft} pointerEvents="none" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.box, compact && styles.boxCompact]}>
            <View accessibilityRole="header" style={styles.brandWrap}>
              <Text style={styles.brand}>
                Super<Text style={styles.brandAccent}>RH</Text>
              </Text>
            </View>
            <Text style={styles.subtitle}>Sistema de Gestão de RH</Text>

            <Field
              label="Usuário"
              icon="person-outline"
              placeholder="Digite seu usuário"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              returnKeyType="next"
              compact={compact}
            />
            <Field
              label="Senha"
              icon="lock-closed-outline"
              placeholder="Digite sua senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              compact={compact}
              rightAccessory={
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  onPress={() => setShowPass(value => !value)}
                  style={styles.eyeButton}
                >
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
                </TouchableOpacity>
              }
            />

            <Button label="Entrar" onPress={handleLogin} loading={loading} style={styles.submit} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            {GOOGLE_SSO_ENABLED ? (
              <View style={styles.sso}>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.line} />
                </View>
                <Button label="Entrar com Google" icon="logo-google" variant="secondary" onPress={handleGoogleLogin} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0F0F', overflow: 'hidden' },
  flex: { flex: 1 },
  haloTop: {
    position: 'absolute', right: -160, top: -180, width: 560, height: 560, borderRadius: 280,
    backgroundColor: 'rgba(184,151,58,0.13)',
  },
  haloLeft: {
    position: 'absolute', left: -220, top: '30%', width: 520, height: 520, borderRadius: 260,
    backgroundColor: 'rgba(184,151,58,0.07)',
  },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  scrollCompact: { justifyContent: 'flex-start', paddingTop: 24 },

  box: {
    width: 380, maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12, paddingVertical: 40, paddingHorizontal: 44,
    borderWidth: 1, borderColor: 'rgba(184,151,58,0.15)',
    shadowColor: '#B8973A', shadowOpacity: 0.3, shadowRadius: 40, shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  boxCompact: { backgroundColor: '#FFFDF8', paddingVertical: 28, paddingHorizontal: 20 },

  brandWrap: { alignItems: 'center', marginBottom: 6 },
  brand: { color: theme.textPrimary, fontFamily: fonts.display, fontSize: 52, lineHeight: 56, letterSpacing: -1 },
  brandAccent: { color: theme.gold },
  subtitle: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 11, marginBottom: 28, textAlign: 'center' },

  group: { marginBottom: 16 },
  label: {
    color: theme.textMuted, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.6,
    marginBottom: 6, textTransform: 'uppercase',
  },
  inputWrap: { alignItems: 'center', borderBottomColor: theme.border, borderBottomWidth: 1.5, flexDirection: 'row' },
  inputWrapFocused: { borderBottomColor: theme.gold },
  inputIcon: { marginRight: 8, marginLeft: 2 },
  input: { color: theme.textPrimary, flex: 1, fontFamily: fonts.body, fontSize: 13, paddingVertical: 10 },
  inputCompact: { fontSize: 16, minHeight: 46 },
  eyeButton: { alignItems: 'center', height: 44, justifyContent: 'center', marginRight: -8, width: 44 },

  submit: { marginTop: 6 },
  error: { color: theme.danger, fontFamily: fonts.body, fontSize: 12, marginTop: 12, textAlign: 'center' },

  sso: { marginTop: 18 },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 14 },
  line: { backgroundColor: theme.border, flex: 1, height: 1 },
  dividerText: { color: theme.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
