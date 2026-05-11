import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contextos/Autenticacao';

const { width } = Dimensions.get('window');
const isWide = width > 768;

const GOLD   = '#C9A84C';
const GOLD2  = '#E2C97E';
const DARK   = '#09090B';
const CARD   = '#111114';
const CARD2  = '#18181C';
const BORDER = 'rgba(201,168,76,0.15)';
const MUTED  = '#8A887F';
const WHITE  = '#F2F0EA';

const FEATURES = [
  { icon: 'people',         label: 'Equipe',      desc: 'Gerencie colaboradores e cargos' },
  { icon: 'briefcase',      label: 'Jurídico',     desc: 'Processos e prazos integrados' },
  { icon: 'calendar',       label: 'Agenda',       desc: 'Audiências e reuniões' },
  { icon: 'megaphone',      label: 'Avisos',       desc: 'Comunicados para toda equipe' },
  { icon: 'umbrella',       label: 'Férias',       desc: 'Controle de ausências' },
  { icon: 'sparkles',       label: 'IA',           desc: 'Assistente inteligente de RH' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const router    = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── HERO ─────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>

            {/* Badge */}
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>PLATAFORMA RH & JURÍDICO</Text>
            </View>

            {/* Título principal */}
            <Text style={styles.heroTitle}>
              Gestão completa{'\n'}
              <Text style={styles.heroTitleGold}>sem complicação.</Text>
            </Text>

            <Text style={styles.heroSub}>
              Colaboradores, processos, agenda e comunicados — tudo em um só lugar para escritórios e departamentos jurídicos.
            </Text>

            {/* Estatísticas decorativas */}
            <View style={styles.statsRow}>
              {[
                { value: '100%', label: 'Web & Mobile' },
                { value: 'JWT',  label: 'Autenticação' },
                { value: 'IA',   label: 'Assistente' },
              ].map(s => (
                <View key={s.label} style={styles.statItem}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Decoração geométrica */}
          <View style={styles.heroDeco}>
            <View style={styles.decoRing1} />
            <View style={styles.decoRing2} />
            <View style={styles.decoCenter}>
              <Text style={styles.decoIcon}>⚖</Text>
            </View>
          </View>
        </View>

        {/* ── FEATURES ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FUNCIONALIDADES</Text>
          <Text style={styles.sectionTitle}>Tudo que você precisa</Text>

          <View style={styles.featuresGrid}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.featureCard}>
                <View style={styles.featureIconBox}>
                  <Ionicons name={f.icon as any} size={20} color={GOLD} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── LOGIN ────────────────────────────────────────── */}
        <View style={styles.loginSection}>
          <View style={styles.loginCard}>

            <View style={styles.loginHeader}>
              <View style={styles.loginSeal}>
                <Text style={styles.loginSealIcon}>⚖</Text>
              </View>
              <View>
                <Text style={styles.loginTitle}>SuperRH</Text>
                <Text style={styles.loginSub}>Acesse sua conta</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#E05252" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>USUÁRIO</Text>
            <TextInput
              style={styles.input}
              placeholder="seu.usuario"
              placeholderTextColor={MUTED}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>SENHA</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={MUTED}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18} color={MUTED}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.loginBtnText}>Entrar</Text>
              }
            </TouchableOpacity>

          </View>
        </View>

        {/* ── FOOTER ───────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SuperRH · Todos os direitos reservados</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DARK },
  scroll: { flexGrow: 1 },

  // ── Hero
  hero: {
    backgroundColor: CARD,
    paddingHorizontal: isWide ? 80 : 24,
    paddingTop: 64,
    paddingBottom: 64,
    flexDirection: isWide ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 40,
  },
  heroInner: { flex: isWide ? 1 : undefined, maxWidth: isWide ? 520 : undefined },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 28,
  },
  badgeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  badgeText: { fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 1.5 },

  heroTitle: {
    fontSize: isWide ? 52 : 36,
    fontWeight: '800',
    color: WHITE,
    lineHeight: isWide ? 62 : 44,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroTitleGold: { color: GOLD },

  heroSub: {
    fontSize: 15,
    color: MUTED,
    lineHeight: 24,
    marginBottom: 36,
    maxWidth: 440,
  },

  statsRow: { flexDirection: 'row', gap: 32 },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontSize: 22, fontWeight: '800', color: GOLD2, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 2, letterSpacing: 0.5 },

  // Decoração hero
  heroDeco: {
    width: isWide ? 240 : 160,
    height: isWide ? 240 : 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  decoRing1: {
    position: 'absolute',
    width: isWide ? 240 : 160,
    height: isWide ? 240 : 160,
    borderRadius: isWide ? 120 : 80,
    borderWidth: 1,
    borderColor: BORDER,
  },
  decoRing2: {
    position: 'absolute',
    width: isWide ? 180 : 120,
    height: isWide ? 180 : 120,
    borderRadius: isWide ? 90 : 60,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  decoCenter: {
    width: isWide ? 96 : 72,
    height: isWide ? 96 : 72,
    borderRadius: isWide ? 48 : 36,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decoIcon: { fontSize: isWide ? 36 : 28 },

  // ── Features
  section: {
    paddingHorizontal: isWide ? 80 : 24,
    paddingVertical: 60,
    backgroundColor: DARK,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: GOLD,
    letterSpacing: 2, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: isWide ? 32 : 24,
    fontWeight: '800',
    color: WHITE,
    marginBottom: 36,
    letterSpacing: -0.3,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 20,
    width: isWide ? '30%' : '46%',
    flexGrow: 1,
  },
  featureIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  featureLabel: { fontSize: 14, fontWeight: '700', color: WHITE, marginBottom: 4 },
  featureDesc:  { fontSize: 12, color: MUTED, lineHeight: 18 },

  // ── Login
  loginSection: {
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: isWide ? 80 : 24,
    paddingVertical: 60,
    alignItems: 'center',
  },
  loginCard: {
    backgroundColor: CARD2,
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: BORDER,
    width: '100%',
    maxWidth: 440,
  },
  loginHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24,
  },
  loginSeal: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  loginSealIcon: { fontSize: 22 },
  loginTitle:    { fontSize: 20, fontWeight: '800', color: WHITE, letterSpacing: -0.3 },
  loginSub:      { fontSize: 12, color: MUTED, marginTop: 2 },

  divider: { height: 1, backgroundColor: BORDER, marginBottom: 24 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,82,82,0.10)',
    borderWidth: 1, borderColor: 'rgba(224,82,82,0.25)',
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#E05252', fontSize: 13, flex: 1 },

  inputLabel: {
    fontSize: 10, fontWeight: '700', color: GOLD,
    letterSpacing: 1.5, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: DARK,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, padding: 14,
    fontSize: 14, color: WHITE,
  },

  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:  {
    padding: 14, backgroundColor: DARK,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
  },

  loginBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  loginBtnText: {
    color: '#000', fontWeight: '800',
    fontSize: 15, letterSpacing: 0.5,
  },

  // ── Footer
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: DARK,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: { fontSize: 11, color: MUTED, letterSpacing: 0.3 },
});
