import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { FeedbackForm } from '../../componentes/FeedbackForm';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { feedbackPdfUrl, feedbackPublicUrl, getFeedback, publishFeedback, revokeFeedback, updateFeedback } from '../../conexoes/feedbacks';
import { confirmAction } from '../../helpers/confirm';
import { useToast } from '../../contextos/Toast';
import type { CreateFeedbackData, Feedback } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

function idFromParam(value: string | string[] | undefined): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function dateTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function statusLabel(status: Feedback['status']) {
  if (status === 'acknowledged') return { label: 'Leitura confirmada', tone: 'success' as const };
  if (status === 'published') return { label: 'Aguardando leitura', tone: 'pending' as const };
  if (status === 'revoked') return { label: 'Revogado', tone: 'muted' as const };
  return { label: 'Rascunho', tone: 'muted' as const };
}

export default function FeedbackDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = idFromParam(rawId);
  const router = useRouter();
  const toast = useToast();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [form, setForm] = useState<CreateFeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const item = await getFeedback(id);
      setFeedback(item);
      setForm({ employee_id: item.employee_id, title: item.title, content: item.content });
    } catch (reason: any) { setError(reason?.message ?? 'Não foi possível carregar o feedback.'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveDraft() {
    if (!id || !form || !form.employee_id || !form.title.trim() || !form.content.trim()) return toast.warning('Preencha colaborador, título e texto do feedback.');
    setSaving(true);
    try {
      const updated = await updateFeedback(id, { ...form, title: form.title.trim(), content: form.content.trim() });
      setFeedback(updated);
      setForm({ employee_id: updated.employee_id, title: updated.title, content: updated.content });
      toast.success('Rascunho salvo.');
    } catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível salvar o rascunho.'); } finally { setSaving(false); }
  }

  function publish() {
    if (!id) return;
    confirmAction('Publicar feedback', 'Ao publicar, um link privado permanente será criado para o colaborador. Deseja continuar?', async () => {
      setSaving(true);
      try { setFeedback(await publishFeedback(id)); toast.success('Feedback publicado. Copie o link para compartilhar.'); }
      catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível publicar o feedback.'); }
      finally { setSaving(false); }
    });
  }

  function revoke() {
    if (!id) return;
    confirmAction('Revogar link', 'O link deixará de funcionar imediatamente e não poderá ser reativado. Deseja revogar?', async () => {
      setSaving(true);
      try { setFeedback(await revokeFeedback(id)); toast.success('Link revogado.'); }
      catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível revogar o link.'); }
      finally { setSaving(false); }
    });
  }

  async function copyLink(token: string) {
    await Clipboard.setStringAsync(feedbackPublicUrl(token));
    toast.success('Link copiado.');
  }

  async function openUrl(url: string) {
    try { await Linking.openURL(url); } catch { toast.error('Não foi possível abrir o link.'); }
  }

  if (!id) return <EmptyState icon="alert-circle-outline" title="Feedback inválido" description="O identificador do feedback não é válido." />;
  if (loading) return <View style={styles.loading}><Skeleton accessibilityLabel="Carregando feedback" style={styles.loadingSkeleton} /></View>;
  if (error || !feedback || !form) return <EmptyState icon="alert-circle-outline" title="Não foi possível abrir o feedback" description={error || 'Feedback não encontrado.'} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} />;

  const status = statusLabel(feedback.status);
  const activeToken = feedback.public_token && feedback.status !== 'revoked' ? feedback.public_token : null;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title={feedback.status === 'draft' ? 'Revisar rascunho' : feedback.title} subtitle={feedback.employee_name ? `Para ${feedback.employee_name}` : 'Feedback individual'} />
      <Card>
        <View style={styles.statusRow}>
          <StatusPill label={status.label} status={status.tone} />
          {feedback.acknowledged_at ? <Text style={styles.confirmed}>Leitura confirmada em {dateTime(feedback.acknowledged_at)}</Text> : null}
        </View>
        {feedback.status === 'draft' ? <FeedbackForm disabled={saving} onChange={setForm} value={form} /> : <View style={styles.readOnly}><Text style={styles.readOnlyTitle}>{feedback.title}</Text><Text style={styles.readOnlyText}>{feedback.content}</Text><Text style={styles.meta}>Publicado em {dateTime(feedback.published_at)}</Text></View>}
        {feedback.status === 'draft' ? (
          <View style={styles.actions}>
            <Button disabled={saving} label="Voltar" onPress={() => router.back()} style={styles.action} variant="secondary" />
            <Button icon="save-outline" label="Salvar" loading={saving} onPress={saveDraft} style={styles.action} variant="secondary" />
            <Button icon="send-outline" label="Publicar" loading={saving} onPress={publish} style={styles.action} />
          </View>
        ) : null}
      </Card>
      {activeToken ? (
        <Card>
          <Text style={styles.sectionTitle}>Link privado do colaborador</Text>
          <Text selectable style={styles.link}>{feedbackPublicUrl(activeToken)}</Text>
          <View style={styles.actions}>
            <Button icon="eye-outline" label="Abrir link" onPress={() => openUrl(feedbackPublicUrl(activeToken))} style={styles.action} variant="secondary" />
            <Button icon="copy-outline" label="Copiar link" onPress={() => copyLink(activeToken)} style={styles.action} variant="secondary" />
            <Button icon="download-outline" label="Baixar PDF" onPress={() => openUrl(feedbackPdfUrl(activeToken))} style={styles.action} variant="secondary" />
          </View>
          <Button icon="ban-outline" label="Revogar link" loading={saving} onPress={revoke} style={styles.revoke} variant="danger" />
        </Card>
      ) : null}
      {feedback.status === 'revoked' ? <Card><Text style={styles.revoked}>Este link foi revogado em {dateTime(feedback.revoked_at)} e não pode mais ser acessado.</Text></Card> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: espaco.xl, padding: espaco.xl, paddingBottom: espaco.secao },
  loading: { padding: espaco.xl },
  loadingSkeleton: { height: espaco.secao },
  statusRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md, marginBottom: espaco.lg },
  confirmed: { ...tipografia.legenda, color: cores.status.sucesso.forte },
  readOnly: { gap: espaco.md },
  readOnlyTitle: { ...tipografia.subtitulo, color: cores.texto.primario },
  readOnlyText: { ...tipografia.corpo, color: cores.texto.primario, lineHeight: espaco.lg },
  meta: { ...tipografia.legenda, color: cores.texto.discreto },
  actions: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginTop: espaco.xl, paddingTop: espaco.md },
  action: { flexGrow: 1 },
  sectionTitle: { ...tipografia.subtitulo, color: cores.texto.primario },
  link: { ...tipografia.corpo, color: cores.texto.accent, marginTop: espaco.sm },
  revoke: { alignSelf: 'flex-start', marginTop: espaco.lg },
  revoked: { ...tipografia.corpo, color: cores.texto.discreto },
});
