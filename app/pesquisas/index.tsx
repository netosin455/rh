// ============================================================
// app/pesquisas/index.tsx — Lista de pesquisas (criar: /pesquisas/nova)
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { getSurveys, deleteSurvey } from '../../conexoes/pesquisas';
import { confirmAction } from '../../helpers/confirm';
import { PulseSurvey } from '../../tipos/modelos';
import { useToast } from '../../contextos/Toast';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

function quantidadePerguntas(s: PulseSurvey): number {
  return s.question_count ?? s.questions?.length ?? 1;
}

function daysLeft(expires_at: string | null | undefined) {
  if (!expires_at) return null;
  const diff = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Encerrada';
  if (diff === 0) return 'Encerra hoje';
  return `${diff}d restante${diff > 1 ? 's' : ''}`;
}

export default function PesquisasScreen() {
  const router = useRouter();
  const toast  = useToast();
  const motion = useMotion();
  const [surveys,    setSurveys]    = useState<PulseSurvey[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState('');

  const activeSurveyCount = surveys.filter((survey) => !survey.expires_at || new Date(survey.expires_at) >= new Date()).length;
  const newSurveyEntering = useMemo(
    () => FadeIn.duration(motion.duracao('normal')),
    [motion],
  );

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setSurveys(await getSurveys());
    } catch (error: any) {
      const message = error?.message ?? 'Não foi possível carregar pesquisas';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  function handleDelete(s: PulseSurvey) {
    confirmAction('Excluir', `Excluir "${s.title}"?`, async () => {
      try {
        await deleteSurvey(s.id);
        load();
      } catch (e: any) {
        toast.error(e?.message ?? 'Erro ao excluir pesquisa');
      }
    });
  }

  function shareLink(s: PulseSurvey) {
    const link = `${API_URL.replace('/api', '')}/responder/${s.id}`.replace('undefined', 'https://super-rh.vercel.app');
    Share.share({ message: `${s.title}\n\nResponda aqui (é anônimo): ${link}` });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader
          title="Pesquisas de pulso"
          subtitle="Colete feedback da equipe e acompanhe as respostas."
          action={<Button icon="add-outline" label="Nova pesquisa" onPress={() => router.push('/pesquisas/nova' as never)} />}
        />

        <MetricCard
          detail={`${surveys.length} pesquisa${surveys.length !== 1 ? 's' : ''} criada${surveys.length !== 1 ? 's' : ''}`}
          indicator={<StatusPill label="Ativas" status="ativo" />}
          label="Pesquisas ativas"
          value={loading ? '—' : activeSurveyCount}
        />

        <Section title="Todas as pesquisas" description="Abra uma pesquisa para consultar os resultados.">
          {loading ? (
            <Card padded={false} style={styles.listCard}>
              <Skeleton accessibilityLabel="Carregando pesquisas" style={styles.skeleton} />
              <Skeleton accessibilityLabel="Carregando pesquisas" style={styles.skeleton} />
              <Skeleton accessibilityLabel="Carregando pesquisas" style={styles.skeleton} />
            </Card>
          ) : loadError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Não foi possível carregar as pesquisas"
              description={loadError}
              action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />}
            />
          ) : surveys.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title="Nenhuma pesquisa criada"
              description="Crie uma pesquisa para coletar feedback da equipe."
              action={<Button icon="add-outline" label="Criar pesquisa" onPress={() => router.push('/pesquisas/nova' as never)} />}
            />
          ) : (
            <View style={styles.surveyList}>
              {surveys.map((survey) => {
                const expired = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
                const responseCount = survey.response_count ?? 0;
                return (
                  <Animated.View entering={newSurveyEntering} key={survey.id}>
                    <Card padded={false} style={expired ? styles.expiredCard : undefined}>
                      <ListRow
                        accessibilityLabel={`Ver resultados de ${survey.title}`}
                        description={survey.question ?? `${quantidadePerguntas(survey)} perguntas`}
                        onPress={() => router.push(`/pesquisas/${survey.id}` as any)}
                        title={survey.title}
                        trailing={(
                          <View style={styles.rowBadges}>
                            <Badge label={`${quantidadePerguntas(survey)} pergunta${quantidadePerguntas(survey) === 1 ? '' : 's'}`} tone="info" />
                            {survey.expires_at ? <StatusPill label={daysLeft(survey.expires_at) ?? ''} status={expired ? 'inativo' : 'pendente'} /> : null}
                          </View>
                        )}
                      />
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{responseCount} resposta{responseCount !== 1 ? 's' : ''}</Text>
                        <Text style={styles.metaText}>{survey.dept_name || 'Toda a empresa'}</Text>
                      </View>
                      <View style={styles.actions}>
                        <Button icon="share-social-outline" label="Compartilhar" onPress={() => shareLink(survey)} style={styles.actionButton} variant="ghost" />
                        <Button icon="bar-chart-outline" label="Ver resultados" onPress={() => router.push(`/pesquisas/${survey.id}` as any)} style={styles.actionButton} variant="ghost" />
                        <Button accessibilityLabel={`Excluir ${survey.title}`} icon="trash-outline" onPress={() => handleDelete(survey)} variant="danger" />
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  listCard: { overflow: 'hidden' },
  skeleton: { marginHorizontal: espaco.md, marginVertical: espaco.sm },
  surveyList: { gap: espaco.md },
  expiredCard: { opacity: 0.55 },
  rowBadges: { alignItems: 'flex-end', gap: espaco.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md, paddingHorizontal: espaco.lg, paddingVertical: espaco.sm },
  metaText: { ...tipografia.legenda, color: cores.texto.discreto },
  actions: { borderTopColor: cores.borda.sutil, borderTopWidth: 1, flexDirection: 'row', gap: espaco.xs, padding: espaco.sm },
  actionButton: { flex: 1 },
});
