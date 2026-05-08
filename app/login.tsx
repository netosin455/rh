// ============================================================
// app/login.tsx — SuperRH
// Tela de login com identidade jurídica premium
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contextos/Autenticacao';
import { theme } from '../estilo/cores';

export default function LoginScreen() {
  const { login } = useAuth();
  const router    = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo e identidade */}
        <View style={styles.header}>
          <View style={styles.seal}>
            <Text style={styles.sealText}>⚖</Text>
          </View>
          <Text style={styles.brand}>SuperRH</Text>
          <Text style={styles.tagline}>GESTÃO JURÍDICA & RECURSOS HUMANOS</Text>
          <View style={styles.goldLine} />
        </View>

        {/* Card de login */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acesso ao Sistema</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>USUÁRIO</Text>
          <TextInput
            style={styles.input}
            placeholder="seu usuário"
            placeholderTextColor={theme.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>SENHA</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnLoading]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          SuperRH · Todos os direitos reservados
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  header: { alignItems: 'center', marginBottom: 36 },
  seal: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, borderColor: theme.gold,
    backgroundColor: theme.goldDim,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  sealText: { fontSize: 28 },
  brand: {
    fontSize: 28, fontWeight: '700', color: theme.white,
    letterSpacing: 2, marginBottom: 6,
  },
  tagline: {
    fontSize: 9, color: theme.gold, letterSpacing: 2.5,
    textAlign: 'center', marginBottom: 16,
  },
  goldLine: { width: 60, height: 1, backgroundColor: theme.gold, opacity: 0.5 },
  card: {
    backgroundColor: theme.surface, borderRadius: 14,
    padding: 24, borderWidth: 1, borderColor: theme.border2,
  },
  cardTitle: {
    fontSize: 15, fontWeight: '600', color: theme.white,
    marginBottom: 20, letterSpacing: 0.3,
  },
  label: {
    fontSize: 10, fontWeight: '600', color: theme.gold,
    letterSpacing: 1.5, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: theme.surface2, borderWidth: 1,
    borderColor: theme.border, borderRadius: 8,
    padding: 13, fontSize: 14, color: theme.text,
  },
  btn: {
    backgroundColor: theme.gold, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  btnLoading: { opacity: 0.7 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  forgotBtn: { alignItems: 'center', marginTop: 16 },
  forgotText: { fontSize: 12, color: theme.textMuted },
  errorBox: {
    backgroundColor: 'rgba(224,82,82,0.12)',
    borderWidth: 1, borderColor: 'rgba(224,82,82,0.3)',
    borderRadius: 8, padding: 10, marginBottom: 8,
  },
  errorText: { color: theme.danger, fontSize: 13 },
  footer: {
    textAlign: 'center', fontSize: 10, color: theme.textMuted,
    marginTop: 32, letterSpacing: 0.3,
  },
});
