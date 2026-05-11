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

// Paleta nova — contraste forte entre seções
const NAVY    = '#0B0F1A';   // hero bg
const NAVY2   = '#111827';   // seção features bg
const LIGHT   = '#F8F7F4';   // seção clara
const GOLD    = '#C9A84C';
const GOLD2   = '#E2C97E';
const GOLD_BG = 'rgba(201,168,76,0.12)';
const BORDER  = 'rgba(201,168,76,0.18)';
const DARK    = '#09090B';
const CARD    = '#161B27';
const WHITE   = '#FFFFFF';
const MUTED_D = '#8A8FA8';   // muted no dark
const MUTED_L = '#6B7280';   // muted no light
const ACCENT  = '#1C2333';   // card no dark

const FEATURES = [
  { icon: 'people-outline',      color: '#4A8FD4', label: 'Equipe',     desc: 'Colaboradores, cargos e histórico em um painel.' },
  { icon: 'briefcase-outline',   color: '#C9A84C', label: 'Jurídico',   desc: 'Processos, OAB e prazos integrados ao RH.' },
  { icon: 'calendar-outline',    color: '#2EBD7C', label: 'Agenda',     desc: 'Audiências, reuniões e prazos com alertas.' },
  { icon: 'megaphone-outline',   color: '#9B72CF', label: 'Avisos',     desc: 'Comunicados fixados para toda a equipe.' },
  { icon: 'umbrella-outline',    color: '#E8955A', label: 'Férias',     desc: 'Solicitações e aprovações de ausências.' },
  { icon: 'sparkles-outline',    color: '#E05252', label: 'IA',         desc: 'Assistente inteligente responde em segundos.' },
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
    if (!username.trim() || !password) { setError('Preencha usuário e senha.'); return; }
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ══════════════════════════════════════════
            HERO — fundo escuro azul-marinho
        ══════════════════════════════════════════ */}
        <View style={styles.hero}>

          {/* Navbar */}
          <View style={styles.nav}>
            <Text style={styles.navBrand}>SuperRH</Text>
            <View style={styles.navPill}>
              <View style={styles.navDot} />
              <Text style={styles.navStatus}>Online</Text>
            </View>
          </View>

          {/* Conteúdo hero */}
          <View style={[styles.heroContent, isWide && styles.heroContentWide]}>
            <View style={styles.heroLeft}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>✦ GESTÃO JURÍDICA & RH</Text>
              </View>

              <Text style={styles.heroH1}>
                Gerencie sua{'\n'}equipe com{'\n'}
                <Text style={styles.heroH1Gold}>precisão.</Text>
              </Text>

              <Text style={styles.heroP}>
                Plataforma completa para escritórios de advocacia e departamentos jurídicos gerenciarem pessoas, processos e prazos.
              </Text>

              <View style={styles.pillsRow}>
                {['Processos', 'Colaboradores', 'Agenda', 'IA'].map(p => (
                  <View key={p} style={styles.pill}>
                    <Text style={styles.pillText}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Card flutuante decorativo */}
            <View style={styles.heroRight}>
              <View style={styles.floatCard}>
                <View style={styles.floatCardHeader}>
                  <View style={styles.floatAvatar}>
                    <Text style={styles.floatAvatarText}>SR</Text>
                  </View>
                  <View>
                    <Text style={styles.floatName}>SuperRH</Text>
                    <Text style={styles.floatRole}>Plataforma ativa</Text>
                  </View>
                  <View style={styles.floatBadge}>
                    <Text style={styles.floatBadgeText}>PRO</Text>
                  </View>
                </View>
                <View style={styles.floatDivider} />
                {[
                  { label: 'Colaboradores', value: '∞', icon: 'people' },
                  { label: 'Processos',     value: '∞', icon: 'briefcase' },
                  { label: 'IA Ativa',      value: 'Sim', icon: 'sparkles' },
                ].map(item => (
                  <View key={item.label} style={styles.floatRow}>
                    <Ionicons name={item.icon as any} size={14} color={GOLD} />
                    <Text style={styles.floatRowLabel}>{item.label}</Text>
                    <Text style={styles.floatRowValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            FEATURES — fundo claro
        ══════════════════════════════════════════ */}
        <View style={styles.featSection}>
          <Text style={styles.featEyebrow}>FUNCIONALIDADES</Text>
          <Text style={styles.featTitle}>Tudo que seu escritório precisa</Text>
          <Text style={styles.featSub}>Módulos integrados para gestão completa de pessoas e processos jurídicos.</Text>

          <View style={styles.featGrid}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.featCard}>
                <View style={[styles.featIconBox, { backgroundColor: `${f.color}18`, borderColor: `${f.color}30` }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.color} />
                </View>
                <Text style={styles.featLabel}>{f.label}</Text>
                <Text style={styles.featDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══════════════════════════════════════════
            LOGIN — fundo escuro com card central
        ══════════════════════════════════════════ */}
        <View style={styles.loginSection}>
          <View style={styles.loginWrap}>

            {/* Lado esquerdo (só no desktop) */}
            {isWide && (
              <View style={styles.loginLeft}>
                <Text style={styles.loginLeftTitle}>
                  Acesso{'\n'}seguro e{'\n'}
                  <Text style={{ color: GOLD }}>rápido.</Text>
                </Text>
                <Text style={styles.loginLeftSub}>
                  Login por credenciais com autenticação JWT. Seus dados protegidos.
                </Text>
                <View style={styles.loginFeats}>
                  {['Autenticação JWT', 'Criptografia bcrypt', 'Sessão segura'].map(f => (
                    <View key={f} style={styles.loginFeatRow}>
                      <Ionicons name="checkmark-circle" size={16} color={GOLD} />
                      <Text style={styles.loginFeatText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Formulário */}
            <View style={styles.loginCard}>
              <View style={styles.loginCardHeader}>
                <View style={styles.loginSeal}>
                  <Text style={{ fontSize: 20 }}>⚖</Text>
                </View>
                <View>
                  <Text style={styles.loginCardTitle}>Entrar no SuperRH</Text>
                  <Text style={styles.loginCardSub}>Use suas credenciais de acesso</Text>
                </View>
              </View>

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
                placeholderTextColor={MUTED_D}
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
                  placeholderTextColor={MUTED_D}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={MUTED_D} />
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
                  : <Text style={styles.loginBtnText}>Entrar na plataforma</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════ */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 SuperRH · Plataforma de Gestão Jurídica e RH</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: NAVY },
  scroll: { flexGrow: 1 },

  // ── Navbar
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: isWide ? 64 : 20, paddingTop: 20, paddingBottom: 12,
  },
  navBrand: { fontSize: 20, fontWeight: '800', color: WHITE, letterSpacing: 0.5 },
  navPill:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(46,189,124,0.12)', borderWidth: 1,
    borderColor: 'rgba(46,189,124,0.25)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  navDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2EBD7C' },
  navStatus: { fontSize: 11, color: '#2EBD7C', fontWeight: '600' },

  // ── Hero
  hero: {
    backgroundColor: NAVY,
    paddingBottom: 64,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  heroContent: {
    paddingHorizontal: isWide ? 64 : 20,
    paddingTop: 40,
    flexDirection: 'column',
    gap: 40,
  },
  heroContentWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLeft: { flex: isWide ? 1 : undefined, maxWidth: isWide ? 560 : undefined },

  heroBadge: {
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start', marginBottom: 24,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '700', color: GOLD2, letterSpacing: 2 },

  heroH1: {
    fontSize: isWide ? 56 : 40,
    fontWeight: '900',
    color: WHITE,
    lineHeight: isWide ? 66 : 50,
    marginBottom: 20,
    letterSpacing: -1,
  },
  heroH1Gold: { color: GOLD },

  heroP: {
    fontSize: 16, color: MUTED_D, lineHeight: 26,
    marginBottom: 28, maxWidth: 480,
  },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: ACCENT, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillText: { fontSize: 12, color: '#CBD5E1', fontWeight: '500' },

  // Float card
  heroRight: { alignItems: isWide ? 'flex-end' : 'flex-start' },
  floatCard: {
    backgroundColor: CARD, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 20, width: isWide ? 260 : '100%',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  floatCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  floatAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GOLD_BG, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  floatAvatarText: { fontSize: 12, fontWeight: '700', color: GOLD },
  floatName:       { fontSize: 13, fontWeight: '700', color: WHITE },
  floatRole:       { fontSize: 11, color: MUTED_D },
  floatBadge: {
    marginLeft: 'auto', backgroundColor: GOLD_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  floatBadgeText: { fontSize: 10, fontWeight: '700', color: GOLD },
  floatDivider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },
  floatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  floatRowLabel: { flex: 1, fontSize: 12, color: MUTED_D },
  floatRowValue: { fontSize: 12, fontWeight: '700', color: WHITE },

  // ── Features (fundo CLARO)
  featSection: {
    backgroundColor: LIGHT,
    paddingHorizontal: isWide ? 64 : 20,
    paddingVertical: 64,
  },
  featEyebrow: {
    fontSize: 10, fontWeight: '800', color: GOLD,
    letterSpacing: 2.5, marginBottom: 10,
  },
  featTitle: {
    fontSize: isWide ? 36 : 26, fontWeight: '800',
    color: '#0B0F1A', marginBottom: 12, letterSpacing: -0.5,
  },
  featSub: {
    fontSize: 15, color: MUTED_L, lineHeight: 24,
    marginBottom: 40, maxWidth: 500,
  },
  featGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  featCard: {
    backgroundColor: WHITE, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 14, padding: 22,
    width: isWide ? '30%' : '46%', flexGrow: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  featIconBox: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  featLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 },
  featDesc:  { fontSize: 12, color: MUTED_L, lineHeight: 18 },

  // ── Login (fundo escuro)
  loginSection: {
    backgroundColor: NAVY2,
    paddingHorizontal: isWide ? 64 : 20,
    paddingVertical: 64,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  loginWrap: {
    flexDirection: isWide ? 'row' : 'column',
    alignItems: isWide ? 'center' : 'stretch',
    gap: 48, maxWidth: 900, alignSelf: 'center', width: '100%',
  },
  loginLeft: { flex: 1 },
  loginLeftTitle: {
    fontSize: isWide ? 44 : 30, fontWeight: '900',
    color: WHITE, lineHeight: isWide ? 54 : 38,
    marginBottom: 16, letterSpacing: -0.5,
  },
  loginLeftSub: { fontSize: 15, color: MUTED_D, lineHeight: 24, marginBottom: 28 },
  loginFeats: { gap: 12 },
  loginFeatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginFeatText: { fontSize: 14, color: '#CBD5E1' },

  loginCard: {
    backgroundColor: CARD, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 32,
    flex: isWide ? 1 : undefined, maxWidth: isWide ? 420 : undefined,
  },
  loginCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  loginSeal: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: GOLD_BG, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  loginCardTitle: { fontSize: 18, fontWeight: '800', color: WHITE },
  loginCardSub:   { fontSize: 12, color: MUTED_D, marginTop: 2 },

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
    backgroundColor: NAVY, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10, padding: 14,
    fontSize: 14, color: WHITE,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    padding: 14, backgroundColor: NAVY,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 10,
  },
  loginBtn: {
    backgroundColor: GOLD, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', marginTop: 24,
  },
  loginBtnText: { color: '#000', fontWeight: '800', fontSize: 15 },

  // ── Footer
  footer: {
    backgroundColor: DARK, paddingVertical: 20, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerText: { fontSize: 11, color: '#4B5563', letterSpacing: 0.3 },
});
