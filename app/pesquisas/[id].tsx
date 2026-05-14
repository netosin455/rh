// ============================================================
// app/pesquisas/[id].tsx — Resultados de uma pesquisa
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSurveyResults } from '../../conexoes/pesquisas';
import { SurveyResults } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';

const SCORE_LABELS: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };
const SCORE_COLORS: Record<number, string> = {
  1: '#F87171', 2: '#FB923C', 3: '#FBBF24', 4: '#34D399', 5: '#60A5FA',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? theme.success : score === 3 ? theme.warning : theme.danger;
  return (
    <View style={[styles.scoreBadge, { backgroundColor: `${color}18`, borderColor: `${color}44` }]}>
      <Text style={[styles.scoreBadgeText, { color }]}>{score.toFixed(1)}</Text>
      <Text style={[styles.scoreBadgeSub, { color }]}>/ 5</Text>
    </View>
  );
}

export default function SurveyResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const [data,      setData]      = useState<SurveyResults | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getSurveyResults(Number(id))
      .then(setData)
      .catch(e => setLoadError(e?.message ?? 'Erro ao carregar resultados'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  if (loadError || !data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
        <Text style={styles.errorText}>{loadError ?? 'Pesquisa não encontrada'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { survey, total_responses, results } = data;
  const isScale = survey.type === 'scale';
  const dist = results.distribution;
  const maxDist = Math.max(...Object.values(dist), 1);

  const shareLink = () => {
    const base = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') ?? 'https://super-rh.vercel.app';
    Share.share({ message: `📊 ${survey.title}\n\n${survey.question}\n\nResponda: ${base}/responder/${survey.id}` });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Voltar */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color={theme.gold} />
        <Text style={styles.backText}>Pesquisas</Text>
      </TouchableOpacity>

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={[styles.typeIcon, {
            backgroundColor: survey.type === 'scale' ? `${theme.info}18` : `${theme.success}18`,
          }]}>
            <Ionicons name={survey.type === 'scale' ? 'stats-chart' : 'list'} size={18}
              color={survey.type === 'scale' ? theme.info : theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{survey.title}</Text>
            <Text style={styles.headerSub}>{survey.dept_name ?? 'Toda empresa'}</Text>
          </View>
          <TouchableOpacity onPress={shareLink} style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={18} color={theme.gold} />
          </TouchableOpacity>
        </View>
        <Text style={styles.question}>"{survey.question}"</Text>
        {survey.expires_at && (
          <Text style={styles.expires}>
            {new Date(survey.expires_at) < new Date() ? '⛔ Encerrada em' : '⏳ Encerra em'}{' '}
            {new Date(survey.expires_at).toLocaleDateString('pt-BR')}
          </Text>
        )}
      </Animated.View>

      {/* KPI total + média */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{total_responses}</Text>
          <Text style={styles.kpiLabel}>Respostas</Text>
        </View>
        {isScale && results.avg !== undefined && (
          <>
            <View style={styles.kpiDivider} />
            <View style={[styles.kpiCard, { alignItems: 'center' }]}>
              <ScoreBadge score={results.avg} />
              <Text style={styles.kpiLabel}>Média geral</Text>
            </View>
          </>
        )}
      </Animated.View>

      {/* Distribuição */}
      {total_responses > 0 ? (
        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.distCard}>
          <Text style={styles.distTitle}>Distribuição de Respostas</Text>

          {isScale
            ? [5, 4, 3, 2, 1].map(score => {
                const count = (dist as Record<number, number>)[score] ?? 0;
                const pct   = total_responses > 0 ? (count / total_responses) * 100 : 0;
                return (
                  <View key={score} style={styles.distRow}>
                    <View style={[styles.scoreLabel, { backgroundColor: `${SCORE_COLORS[score]}18` }]}>
                      <Text style={[styles.scoreLabelText, { color: SCORE_COLORS[score] }]}>{score}</Text>
                    </View>
                    <Text style={styles.distSubLabel}>{SCORE_LABELS[score]}</Text>
                    <View style={styles.distBarWrap}>
                      <View style={[styles.distBar, {
                        width: `${Math.max(2, pct)}%`,
                        backgroundColor: SCORE_COLORS[score],
                      }]} />
                    </View>
                    <Text style={[styles.distCount, { color: SCORE_COLORS[score] }]}>{count}</Text>
                  </View>
                );
              })
            : Object.entries(dist).map(([opt, count]) => {
                const pct = total_responses > 0 ? ((count as number) / total_responses) * 100 : 0;
                return (
                  <View key={opt} style={styles.distRow}>
                    <Text style={styles.choiceLabel} numberOfLines={1}>{opt}</Text>
                    <View style={styles.distBarWrap}>
                      <View style={[styles.distBar, { width: `${Math.max(2, pct)}%`, backgroundColor: theme.gold }]} />
                    </View>
                    <Text style={[styles.distCount, { color: theme.gold }]}>{count as number}</Text>
                  </View>
                );
              })
          }
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(160).duration(300)} style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={32} color={theme.textMuted} />
          <Text style={styles.emptyText}>Nenhuma resposta ainda</Text>
          <TouchableOpacity style={styles.shareFullBtn} onPress={shareLink}>
            <Ionicons name="share-social-outline" size={15} color={theme.bg} />
            <Text style={styles.shareFullText}>Compartilhar link de resposta</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, gap: 12 },
  errorText: { color: theme.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  backBtn:   { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.goldDim, borderRadius: 10 },
  backBtnText: { color: theme.gold, fontWeight: '700', fontSize: 13 },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: theme.gold, fontWeight: '600' },

  headerCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 14,
  },
  headerTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  typeIcon:   { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: theme.white },
  headerSub:  { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  shareBtn:   { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  question:   { fontSize: 14, color: theme.textLight, fontStyle: 'italic', lineHeight: 20 },
  expires:    { fontSize: 12, color: theme.textMuted, marginTop: 8 },

  kpiRow:    { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 14, overflow: 'hidden' },
  kpiCard:   { flex: 1, alignItems: 'center', padding: 18, gap: 4 },
  kpiDivider:{ width: 1, backgroundColor: theme.border },
  kpiValue:  { fontSize: 32, fontWeight: '800', color: theme.gold },
  kpiLabel:  { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  scoreBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  scoreBadgeText: { fontSize: 24, fontWeight: '800' },
  scoreBadgeSub:  { fontSize: 13, fontWeight: '600' },

  distCard:  { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 14 },
  distTitle: { fontSize: 13, fontWeight: '800', color: theme.gold, letterSpacing: 0.3, marginBottom: 16 },
  distRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scoreLabel: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scoreLabelText: { fontSize: 13, fontWeight: '800' },
  distSubLabel: { fontSize: 11, color: theme.textMuted, width: 64 },
  choiceLabel:  { fontSize: 12, color: theme.text, width: 90 },
  distBarWrap: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  distBar:     { height: '100%', borderRadius: 5 },
  distCount:   { width: 24, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  emptyCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: theme.textMuted },
  shareFullBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.gold, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  shareFullText: { fontSize: 13, fontWeight: '700', color: theme.bg },
});
