import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { feedbackPdfUrl, feedbackPublicUrl, getFeedbacks } from '../../conexoes/feedbacks';
import { useAuth } from '../../contextos/Autenticacao';
import { useToast } from '../../contextos/Toast';
import type { Feedback } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const RH_ROLES = ['super_admin', 'admin', 'rh', 'adm'];

function feedbackStatus(feedback: Feedback) {
  if (feedback.status === 'acknowledged') return { label: 'Leitura confirmada', status: 'success' as const };
  if (feedback.status === 'published') return { label: 'Aguardando leitura', status: 'pending' as const };
  if (feedback.status === 'revoked') return { label: 'Revogado', status: 'muted' as const };
  return { label: 'Rascunho', status: 'muted' as const };
}

function dateTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export default function FeedbacksScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const canManage = RH_ROLES.includes(user?.role ?? '');

  const load = useCallback(async () => {
    setError('');
    try { setFeedbacks(await getFeedbacks()); } catch (reason: any) { setError(reason?.message ?? 'Não foi possível carregar feedbacks.'); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function copyLink(feedback: Feedback) {
    if (!feedback.public_token) return;
    await Clipboard.setStringAsync(feedbackPublicUrl(feedback.public_token));
    toast.success('Link copiado.');
  }

  async function openUrl(url: string) {
    try { await Linking.openURL(url); } catch { toast.error('Não foi possível abrir o link.'); }
  }

  if (!canManage) {
    return <EmptyState icon="lock-closed-outline" title="Acesso restrito" description="Apenas RH e administradores podem gerenciar feedbacks." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={cores.accent.dourado} />}
    >
      <ScreenHeader
        title="Feedbacks"
        subtitle="Publique feedbacks individuais e acompanhe a confirmação de leitura."
        action={<Button icon="add-outline" label="Novo feedback" onPress={() => router.push('/feedbacks/novo' as never)} />}
      />
      <Section title="Todos os feedbacks" description="O link só deixa de funcionar quando for revogado pelo RH.">
        {loading ? <Card><Skeleton accessibilityLabel="Carregando feedbacks" style={styles.skeleton} /><Skeleton accessibilityLabel="Carregando feedbacks" style={styles.skeleton} /></Card> : null}
        {!loading && error ? <EmptyState icon="alert-circle-outline" title="Não foi possível carregar feedbacks" description={error} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} /> : null}
        {!loading && !error && !feedbacks.length ? <EmptyState icon="chatbox-ellipses-outline" title="Nenhum feedback criado" description="Crie um rascunho para começar." action={<Button icon="add-outline" label="Novo feedback" onPress={() => router.push('/feedbacks/novo' as never)} />} /> : null}
        <View style={styles.list}>
          {feedbacks.map((feedback) => {
            const token = feedback.public_token;
            const status = feedbackStatus(feedback);
            return (
              <Card key={feedback.id} style={styles.card}>
                <View style={styles.rowTop}>
                  <View style={styles.titleBlock}>
                    <Text style={styles.title}>{feedback.title}</Text>
                    <Text style={styles.employee}>{feedback.employee_name ?? 'Colaborador'}</Text>
                  </View>
                  <StatusPill label={status.label} status={status.status} />
                </View>
                {feedback.acknowledged_at ? <Text style={styles.confirmed}>Leitura confirmada em {dateTime(feedback.acknowledged_at)}</Text> : null}
                {feedback.status === 'published' ? <Text style={styles.pending}>Aguardando confirmação de leitura.</Text> : null}
                <View style={styles.actions}>
                  <Button
                    icon="eye-outline"
                    label={token && feedback.status !== 'revoked' ? 'Abrir' : 'Ver detalhes'}
                    onPress={() => token && feedback.status !== 'revoked' ? openUrl(feedbackPublicUrl(token)) : router.push(`/feedbacks/${feedback.id}` as never)}
                    style={styles.action}
                    variant="secondary"
                  />
                  <Button icon="create-outline" label="Gerenciar" onPress={() => router.push(`/feedbacks/${feedback.id}` as never)} style={styles.action} variant="ghost" />
                  {token && feedback.status !== 'revoked' ? <Button icon="copy-outline" label="Copiar link" onPress={() => copyLink(feedback)} style={styles.action} variant="ghost" /> : null}
                  {token && feedback.status !== 'revoked' ? <Button icon="download-outline" label="Baixar PDF" onPress={() => openUrl(feedbackPdfUrl(token))} style={styles.action} variant="ghost" /> : null}
                </View>
              </Card>
            );
          })}
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: espaco.xl, padding: espaco.xl, paddingBottom: espaco.secao },
  skeleton: { height: espaco.xxl, marginBottom: espaco.sm },
  list: { gap: espaco.md },
  card: { gap: espaco.md },
  rowTop: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  titleBlock: { flex: 1 },
  title: { ...tipografia.subtitulo, color: cores.texto.primario },
  employee: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.micro },
  confirmed: { ...tipografia.legenda, color: cores.status.sucesso.forte },
  pending: { ...tipografia.legenda, color: cores.status.pendente.forte },
  actions: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, paddingTop: espaco.md },
  action: { flexGrow: 1 },
});
