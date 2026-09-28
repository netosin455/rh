import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '../contextos/Autenticacao';
import { BrandMark } from '../componentes/BrandMark';
import { Button } from '../componentes/Button';
import { Input } from '../componentes/Input';
import { theme } from '../estilo/cores';
import { borda, espaco, largura, raio, tamanho } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';
import { tipografia } from '../estilo/tipografia';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const motion = useMotion();
  const { width } = useWindowDimensions();
  const compact = width <= 768;
  const entrance = useSharedValue(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';
  const GOOGLE_SSO_ENABLED = !!process.env.EXPO_PUBLIC_GOOGLE_SSO;
  const redirectDelay = motion.duracao('fast');

  useEffect(() => {
    entrance.value = withTiming(1, {
      duration: motion.duracao('normal'),
      easing: motion.entrada,
    });
  }, [entrance, motion]);

  useEffect(() => {
    if (!success) return undefined;

    const redirectTimer = setTimeout(() => router.replace('/(tabs)'), redirectDelay);
    return () => clearTimeout(redirectTimer);
  }, [redirectDelay, router, success]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: motion.reduzMovimento ? espaco.zero : (1 - entrance.value) * espaco.sm }],
  }));

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
      setSuccess('');
      setError('Preencha usuário e senha.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await login(username, password);
      setSuccess('Login realizado. Abrindo o SuperRH.');
    } catch (e: any) {
      setError(e.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, compact && styles.scrollCompact]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View pointerEvents="none" style={styles.glow} />
          <Animated.View style={[styles.card, compact && styles.cardCompact, entranceStyle]}>
            <BrandMark size="grande" />

            <View style={styles.form}>
              <Input
                label="Usuário"
                placeholder="Digite seu usuário"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Input
                label="Senha"
                placeholder="Digite sua senha"
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
                autoCorrect={false}
                secureTextEntry={!showPass}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                rightAccessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                    onPress={() => setShowPass(value => !value)}
                    style={styles.passwordVisibility}
                  >
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={tamanho.iconeMedio}
                      color={theme.texto.discreto}
                    />
                  </Pressable>
                }
              />
            </View>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorFeedback}>
                <Ionicons name="alert-circle-outline" size={tamanho.iconeMedio} color={theme.status.erro.forte} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View accessibilityLiveRegion="polite" style={styles.successFeedback}>
                <Ionicons name="checkmark-circle-outline" size={tamanho.iconeMedio} color={theme.status.sucesso.forte} />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            <Button
              label="Entrar"
              onPress={handleLogin}
              loading={loading}
              disabled={Boolean(success)}
              style={styles.submit}
            />

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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: theme.sidebarSemantica.superficie, flex: 1 },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: espaco.tela },
  scrollCompact: { padding: espaco.xxl },
  // Único detalhe de marca da tela: um halo dourado atrás do cartão, um único momento com
  // propósito (dar profundidade ao instante de entrada), não decoração espalhada. `boxShadow`
  // (só web, é onde o app roda) dá o desfoque real — círculo sólido + shadow criava um anel duro.
  glow: Platform.select({
    web: { boxShadow: `0 0 200px 80px ${theme.accent.dourado}22`, height: 1, position: 'absolute', width: 1 } as any,
    default: { backgroundColor: theme.accent.sutil, borderRadius: 999, height: 420, opacity: 0.5, position: 'absolute', width: 420 },
  }),
  card: {
    backgroundColor: theme.superficie.elevada,
    borderColor: theme.bordaSemantica.sutil,
    borderRadius: raio.cartao,
    borderWidth: borda.fina,
    elevation: 16,
    gap: espaco.xxxl,
    maxWidth: largura.leitura,
    padding: espaco.gigante,
    shadowColor: theme.elevacao.backdrop,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 1,
    shadowRadius: 60,
    width: largura.completa,
  },
  cardCompact: { gap: espaco.xxl, padding: espaco.xxl },
  form: { gap: espaco.lg },
  passwordVisibility: {
    alignItems: 'center',
    height: tamanho.toqueMinimo,
    justifyContent: 'center',
    width: tamanho.toqueMinimo,
  },
  submit: { width: largura.completa },
  errorFeedback: {
    alignItems: 'center',
    backgroundColor: theme.status.erro.superficie,
    borderColor: theme.status.erro.borda,
    borderRadius: raio.controle,
    borderWidth: borda.fina,
    flexDirection: 'row',
    gap: espaco.sm,
    padding: espaco.md,
  },
  errorText: { ...tipografia.legenda, color: theme.status.erro.forte, flex: 1 },
  successFeedback: {
    alignItems: 'center',
    backgroundColor: theme.status.sucesso.superficie,
    borderColor: theme.status.sucesso.borda,
    borderRadius: raio.controle,
    borderWidth: borda.fina,
    flexDirection: 'row',
    gap: espaco.sm,
    padding: espaco.md,
  },
  successText: { ...tipografia.legenda, color: theme.status.sucesso.forte, flex: 1 },
  sso: { gap: espaco.lg },
  divider: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  line: { backgroundColor: theme.bordaSemantica.sutil, flex: 1, height: borda.fina },
  dividerText: { ...tipografia.legenda, color: theme.texto.discreto },
});
