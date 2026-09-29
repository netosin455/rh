import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { Skeleton } from '../../componentes/Skeleton';
import { acknowledgeFeedback, feedbackPdfUrl, getPublicFeedback } from '../../conexoes/feedbacks';
import { useToast } from '../../contextos/Toast';
import type { PublicFeedback } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

function tokenFromParam(value: string | string[] | undefined): string | null {
  const token = Array.isArray(value) ? value[0] : value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function PublicFeedbackScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token?: string }>();
  const token = tokenFromParam(rawToken);
  const toast = useToast();
  const [feedback, setFeedback] = useState<PublicFeedback | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try { setFeedback(await getPublicFeedback(token)); } catch (reason: any) { setError(reason?.message ?? 'Não foi possível abrir este feedback.'); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function acknowledge() {
    if (!token || !checked || feedback?.status === 'acknowledged') return;
    setSaving(true);
    try {
      const result = await acknowledgeFeedback(token);
      setFeedback((current) => current ? { ...current, status: 'acknowledged', acknowledged_at: result.acknowledged_at } : current);
      toast.success('Leitura confirmada.');
    } catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível confirmar a leitura.'); } finally { setSaving(false); }
  }

  async function download() {
    if (!token) return;
    try { await Linking.openURL(feedbackPdfUrl(token)); } catch { toast.error('Não foi possível baixar o PDF.'); }
  }

  if (!token) return <EmptyState icon="alert-circle-outline" title="Link inválido" description="Confira se o endereço foi copiado por completo." />;
  if (loading) return <View style={styles.loading}><Skeleton accessibilityLabel="Carregando feedback" style={styles.loadingSkeleton} /></View>;
  if (error || !feedback) return <EmptyState icon="lock-closed-outline" title="Feedback indisponível" description={error || 'Este feedback não está disponível.'} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} />;

  const confirmed = feedback.status === 'acknowledged';
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.brand}><Text style={styles.brandName}>SuperRH</Text><Text style={styles.brandSubtitle}>Feedback individual</Text></View>
      <Card style={styles.card}>
        <Text style={styles.eyebrow}>Para {feedback.employee_name}</Text>
        <Text accessibilityRole="header" style={styles.title}>{feedback.title}</Text>
        <Text style={styles.company}>{feedback.company_name}</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>{feedback.content}</Text>
        <Text style={styles.published}>Publicado em {dateTime(feedback.published_at)}</Text>
        <Button icon="download-outline" label="Baixar PDF" onPress={download} style={styles.pdfButton} variant="secondary" />
        {confirmed ? (
          <View accessibilityRole="alert" style={styles.successBox}>
            <Ionicons color={cores.status.sucesso.forte} name="checkmark-circle" size={tamanho.iconeMedio} />
            <View style={styles.successCopy}><Text style={styles.successTitle}>Leitura confirmada</Text><Text style={styles.successText}>Registrada em {dateTime(feedback.acknowledged_at!)}</Text></View>
          </View>
        ) : (
          <View style={styles.confirmArea}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} disabled={saving} onPress={() => setChecked((current) => !current)} style={[styles.checkboxRow, checked && styles.checkboxRowChecked]}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Ionicons color={cores.texto.sobreAccent} name="checkmark" size={tamanho.iconePequeno} /> : null}</View>
              <Text style={styles.checkboxLabel}>Li e estou ciente deste feedback</Text>
            </Pressable>
            <Button disabled={!checked} icon="checkmark-outline" label="Confirmar leitura" loading={saving} onPress={acknowledge} />
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', flexGrow: 1, gap: espaco.lg, padding: espaco.xl, paddingBottom: espaco.secao },
  loading: { padding: espaco.xl },
  loadingSkeleton: { height: espaco.secao },
  brand: { alignSelf: 'stretch', maxWidth: espaco.tela * 3 },
  brandName: { ...tipografia.titulo, color: cores.texto.primario },
  brandSubtitle: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
  card: { alignSelf: 'stretch', gap: espaco.md, maxWidth: espaco.tela * 3 },
  eyebrow: { ...tipografia.legenda, color: cores.texto.discreto },
  title: { ...tipografia.titulo, color: cores.texto.primario },
  company: { ...tipografia.corpo, color: cores.texto.discreto },
  divider: { backgroundColor: cores.borda.sutil, height: borda.fina, marginVertical: espaco.sm },
  body: { ...tipografia.corpo, color: cores.texto.primario, lineHeight: espaco.lg },
  published: { ...tipografia.legenda, color: cores.texto.discreto },
  pdfButton: { alignSelf: 'flex-start', marginTop: espaco.sm },
  confirmArea: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, gap: espaco.lg, marginTop: espaco.lg, paddingTop: espaco.lg },
  checkboxRow: { alignItems: 'center', borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, padding: espaco.md },
  checkboxRowChecked: { backgroundColor: cores.status.informacao.superficie, borderColor: cores.accent.dourado },
  checkbox: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.pill, borderWidth: borda.fina, height: espaco.lg, justifyContent: 'center', width: espaco.lg },
  checkboxChecked: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  checkboxLabel: { ...tipografia.corpoForte, color: cores.texto.primario, flex: 1 },
  successBox: { alignItems: 'center', backgroundColor: cores.status.sucesso.superficie, borderColor: cores.status.sucesso.borda, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, marginTop: espaco.lg, padding: espaco.md },
  successCopy: { flex: 1 },
  successTitle: { ...tipografia.corpoForte, color: cores.status.sucesso.forte },
  successText: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
});
