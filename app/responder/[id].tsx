// ============================================================
// app/responder/[id].tsx — Página PÚBLICA de resposta
// Sem autenticação — colaborador acessa pelo link compartilhado
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { respondSurvey } from '../../conexoes/pesquisas';
import { theme } from '../../estilo/cores';

// Gera UUID v4 simples sem dependência externa
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function getVoterToken(): Promise<string> {
  const key = 'superrh_voter_token';
  let token = await AsyncStorage.getItem(key);
  if (!token) {
    token = uuidv4();
    await AsyncStorage.setItem(key, token);
  }
  return token;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://super-rh.vercel.app';

interface SurveyPublic {
  id: number;
  title: string;
  question: string;
  type: 'scale' | 'choice';
  options: string[] | null;
  expires_at: string | null;
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo',
};
const SCORE_ICONS: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄',
};

export default function ResponderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [survey,    setSurvey]    = useState<SurveyPublic | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected,  setSelected]  = useState<number | string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/surveys/${id}`)
      .then(r => r.ok ? r.json() : r.json().then((b: any) => Promise.reject(b?.error ?? 'Erro')))
      .then((data: SurveyPublic) => {
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setLoadError('Esta pesquisa já foi encerrada.');
        } else {
          setSurvey(data);
        }
      })
      .catch((e: any) => setLoadError(typeof e === 'string' ? e : 'Pesquisa não encontrada'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    if (selected === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const voter_token = await getVoterToken();
      const payload = survey?.type === 'scale'
        ? { score: Number(selected), voter_token }
        : { choice: String(selected), voter_token };
      await respondSurvey(Number(id), payload);
      setSubmitted(true);
    } catch (e: unknown) {
      const er = e as { message?: string };
      const msg = er?.message ?? 'Erro ao enviar resposta';
      setSubmitError(msg.includes('já respondeu') ? 'Você já respondeu esta pesquisa anteriormente.' : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Ionicons name="close-circle-outline" size={48} color={theme.danger} />
        <Text style={styles.errorTitle}>Pesquisa indisponível</Text>
        <Text style={styles.errorSub}>{loadError}</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.centered}>
        <Animated.View entering={FadeInUp.duration(400)} style={styles.successWrap}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Resposta registrada!</Text>
          <Text style={styles.successSub}>Obrigado pelo seu feedback. Ele ajuda a melhorar o ambiente de trabalho.</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo/marca */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.brandRow}>
        <View style={styles.brandIcon}>
          <Ionicons name="briefcase" size={18} color={theme.gold} />
        </View>
        <Text style={styles.brandName}>SuperRH</Text>
      </Animated.View>

      {/* Card da pesquisa */}
      <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.card}>
        <Text style={styles.cardLabel}>PESQUISA DE PULSO</Text>
        <Text style={styles.cardTitle}>{survey!.title}</Text>
        <View style={styles.divider} />
        <Text style={styles.question}>{survey!.question}</Text>
      </Animated.View>

      {/* Opções de resposta */}
      {survey!.type === 'scale' ? (
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.scaleWrap}>
          <Text style={styles.scaleHint}>Toque para selecionar</Text>
          <View style={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map(score => {
              const active = selected === score;
              return (
                <TouchableOpacity
                  key={score}
                  style={[styles.scaleBtn, active && styles.scaleBtnActive]}
                  onPress={() => setSelected(score)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.scaleEmoji}>{SCORE_ICONS[score]}</Text>
                  <Text style={[styles.scaleNum, active && { color: theme.bg }]}>{score}</Text>
                  <Text style={[styles.scaleText, active && { color: theme.bg }]}>{SCORE_LABELS[score]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.choiceWrap}>
          {(survey!.options ?? []).map((opt, i) => {
            const active = selected === opt;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                onPress={() => setSelected(opt)}
                activeOpacity={0.75}
              >
                <View style={[styles.choiceRadio, active && styles.choiceRadioActive]}>
                  {active && <View style={styles.choiceRadioDot} />}
                </View>
                <Text style={[styles.choiceText, active && { color: theme.white, fontWeight: '700' }]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {/* Erro de submit */}
      {submitError && (
        <Text style={styles.submitError}>{submitError}</Text>
      )}

      {/* Botão enviar */}
      <Animated.View entering={FadeInDown.delay(240).duration(350)}>
        <TouchableOpacity
          style={[styles.submitBtn, (!selected || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selected || submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color={theme.bg} size="small" />
            : <>
                <Ionicons name="send" size={16} color={theme.bg} />
                <Text style={styles.submitText}>Enviar Resposta</Text>
              </>
          }
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.anonNote}>
        🔒 Sua resposta é anônima e não será vinculada ao seu nome.
      </Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 32 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, padding: 32, gap: 14 },

  errorTitle: { fontSize: 18, fontWeight: '700', color: theme.white, textAlign: 'center' },
  errorSub:   { fontSize: 14, color: theme.textMuted, textAlign: 'center' },

  successWrap:  { alignItems: 'center', gap: 14 },
  successEmoji: { fontSize: 56 },
  successTitle: { fontSize: 22, fontWeight: '800', color: theme.white, textAlign: 'center' },
  successSub:   { fontSize: 15, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: theme.goldDim,
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 16, fontWeight: '800', color: theme.gold, letterSpacing: 1 },

  card: {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 20, marginBottom: 24,
  },
  cardLabel: { fontSize: 10, color: theme.gold, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: theme.white, lineHeight: 26, marginBottom: 14 },
  divider:   { height: 1, backgroundColor: theme.border, marginBottom: 14 },
  question:  { fontSize: 16, color: theme.text, lineHeight: 24 },

  scaleWrap: { marginBottom: 24 },
  scaleHint: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginBottom: 12, letterSpacing: 0.5 },
  scaleRow:  { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  scaleBtn:  {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
  },
  scaleBtnActive: { backgroundColor: theme.gold, borderColor: theme.gold },
  scaleEmoji: { fontSize: 22 },
  scaleNum:   { fontSize: 18, fontWeight: '800', color: theme.gold },
  scaleText:  { fontSize: 9, color: theme.textMuted, textAlign: 'center', fontWeight: '600', letterSpacing: 0.3 },

  choiceWrap: { gap: 10, marginBottom: 24 },
  choiceBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
  },
  choiceBtnActive: { borderColor: theme.gold, backgroundColor: `${theme.gold}10` },
  choiceRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceRadioActive: { borderColor: theme.gold },
  choiceRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.gold },
  choiceText: { fontSize: 15, color: theme.textMuted, flex: 1 },

  submitError: { fontSize: 13, color: theme.danger, textAlign: 'center', marginBottom: 10 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.gold, borderRadius: 14, paddingVertical: 16, marginBottom: 16,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: '800', color: theme.bg },

  anonNote: { fontSize: 12, color: theme.textMuted, textAlign: 'center', lineHeight: 18 },
});
