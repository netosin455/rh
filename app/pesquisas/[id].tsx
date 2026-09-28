// ============================================================
// app/pesquisas/[id].tsx — Resultados de uma pesquisa
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSurveyResults } from '../../conexoes/pesquisas';
import { SurveyResults } from '../../tipos/modelos';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { MetricCard } from '../../componentes/MetricCard';
import { ProgressBar } from '../../componentes/ProgressBar';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';

const SCORE_LABELS: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };

function progressTone(score: number): 'accent' | 'success' | 'info' | 'danger' {
  if (score <= 1) return 'danger';
  if (score >= 5) return 'info';
  if (score >= 4) return 'success';
  return 'accent';
}

export default function SurveyResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const motion = useMotion();
  const [data,      setData]      = useState<SurveyResults | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const contentEntering = useMemo(
    () => FadeIn.duration(motion.duracao('normal')),
    [motion],
  );

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getSurveyResults(Number(id))
      .then(setData)
      .catch((error) => setLoadError(error?.message ?? 'Erro ao carregar resultados'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loadError || (!loading && !data)) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="alert-circle-outline"
          title="Não foi possível carregar a pesquisa"
          description={loadError ?? 'Pesquisa não encontrada.'}
          action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />}
        />
        <Button icon="arrow-back-outline" label="Voltar para pesquisas" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View style={styles.loading}>
        <Skeleton height={espaco.tela} accessibilityLabel="Carregando título da pesquisa" />
        <Skeleton height={espaco.tela} accessibilityLabel="Carregando métricas da pesquisa" />
        <Skeleton height={espaco.gigante} accessibilityLabel="Carregando distribuição de respostas" />
      </View>
    );
  }

  const { survey, total_responses, results } = data;
  const isScale = survey.type === 'scale';
  const dist = results.distribution;
  const maxDist = Math.max(...Object.values(dist), 1);

  const shareLink = () => {
    const base = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') ?? 'https://super-rh.vercel.app';
    Share.share({ message: `${survey.title}\n\n${survey.question}\n\nResponda: ${base}/responder/${survey.id}` });
  };

  const expirationLabel = survey.expires_at
    ? `${new Date(survey.expires_at) < new Date() ? 'Encerrada em' : 'Encerra em'} ${new Date(survey.expires_at).toLocaleDateString('pt-BR')}`
    : null;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Animated.View entering={contentEntering} style={styles.screen}>
        <ScreenHeader
          action={(
            <View style={styles.headerActions}>
              <Button accessibilityLabel="Voltar para pesquisas" icon="arrow-back-outline" onPress={() => router.back()} variant="ghost" />
              <Button accessibilityLabel="Compartilhar link de resposta" icon="share-social-outline" onPress={shareLink} variant="ghost" />
            </View>
          )}
          subtitle={survey.dept_name ?? 'Toda a empresa'}
          title={survey.title}
        />

        <Card>
          <View style={styles.surveySummary}>
            <View style={styles.summaryBadges}>
              <Badge label={isScale ? 'Escala 1–5' : 'Múltipla escolha'} tone={isScale ? 'info' : 'success'} />
              {expirationLabel ? <StatusPill label={expirationLabel} status={survey.expires_at && new Date(survey.expires_at) < new Date() ? 'inativo' : 'pendente'} /> : null}
            </View>
            <Text style={styles.question}>{survey.question}</Text>
          </View>
        </Card>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <MetricCard detail="Respostas recebidas" label="Participação" value={total_responses} />
          </View>
          {isScale && results.avg !== undefined ? (
            <View style={styles.metric}>
              <MetricCard detail="Em uma escala de 1 a 5" label="Média geral" value={results.avg.toFixed(1)} />
            </View>
          ) : null}
        </View>

        {total_responses > 0 ? (
          <Section title="Distribuição das respostas" description="Veja como a equipe se posicionou nesta pesquisa.">
            <Card>
              <View style={styles.distribution}>
                {isScale
                  ? [5, 4, 3, 2, 1].map((score) => {
                      const count = (dist as Record<number, number>)[score] ?? 0;
                      const percentage = (count / total_responses) * 100;
                      return (
                        <View key={score} style={styles.distributionItem}>
                          <View style={styles.distributionHeader}>
                            <Badge label={`${score} — ${SCORE_LABELS[score]}`} tone={score <= 1 ? 'danger' : score >= 4 ? 'success' : 'gold'} />
                            <Text style={styles.distributionCount}>{count} resposta{count !== 1 ? 's' : ''} · {Math.round(percentage)}%</Text>
                          </View>
                          <ProgressBar accessibilityLabel={`${SCORE_LABELS[score]}: ${count} respostas`} tone={progressTone(score)} value={percentage} />
                        </View>
                      );
                    })
                  : Object.entries(dist).map(([option, count]) => {
                      const numericCount = count as number;
                      const percentage = (numericCount / total_responses) * 100;
                      return (
                        <View key={option} style={styles.distributionItem}>
                          <View style={styles.distributionHeader}>
                            <Text numberOfLines={2} style={styles.choiceLabel}>{option}</Text>
                            <Text style={styles.distributionCount}>{numericCount} resposta{numericCount !== 1 ? 's' : ''} · {Math.round(percentage)}%</Text>
                          </View>
                          <ProgressBar accessibilityLabel={`${option}: ${numericCount} respostas`} value={percentage} />
                        </View>
                      );
                    })}
              </View>
            </Card>
          </Section>
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title="Nenhuma resposta ainda"
            description="Compartilhe o link para começar a receber o feedback da equipe."
            action={<Button icon="share-social-outline" label="Compartilhar link" onPress={shareLink} />}
          />
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { padding: espaco.xl, paddingBottom: espaco.tela },
  screen: { gap: espaco.secao },
  centered: { alignItems: 'center', backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.md, justifyContent: 'center', padding: espaco.xl },
  loading: { backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.lg, padding: espaco.xl },
  headerActions: { flexDirection: 'row', gap: espaco.xs },
  surveySummary: { gap: espaco.md },
  summaryBadges: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  question: { ...tipografia.corpo, color: cores.texto.secundario },
  metricsRow: { flexDirection: 'row', gap: espaco.md },
  metric: { flex: 1 },
  distribution: { gap: espaco.lg },
  distributionItem: { gap: espaco.sm },
  distributionHeader: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  distributionCount: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  choiceLabel: { ...tipografia.corpoForte, color: cores.texto.primario, flex: 1 },
});
