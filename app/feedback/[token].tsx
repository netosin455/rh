import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../componentes/Button';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { Skeleton } from '../../componentes/Skeleton';
import { acknowledgeFeedback, feedbackPdfUrl, getPublicFeedback } from '../../conexoes/feedbacks';
import { useToast } from '../../contextos/Toast';
import type { PublicFeedback } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';

const MAX_OBSERVACAO = 1000;

function tokenFromParam(value: string | string[] | undefined): string | null {
  const token = Array.isArray(value) ? value[0] : value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function dateOnly(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(value));
}

function senderRole(role: string | null): string {
  if (role === 'rh') return 'Recursos Humanos';
  if (role === 'admin' || role === 'super_admin' || role === 'adm') return 'Administração';
  return 'SuperRH';
}

export default function PublicFeedbackScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token?: string }>();
  const token = tokenFromParam(rawToken);
  const toast = useToast();
  const motion = useMotion();
  const { width } = useWindowDimensions();
  const [feedback, setFeedback] = useState<PublicFeedback | null>(null);
  const [checked, setChecked] = useState(false);
  // Observação opcional do colaborador: enviada junto com a confirmação (nunca obrigatória).
  const [note, setNote] = useState('');
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
      const result = await acknowledgeFeedback(token, note);
      setFeedback((current) => current ? { ...current, status: 'acknowledged', acknowledged_at: result.acknowledged_at, acknowledgment_note: result.acknowledgment_note ?? (note.trim() || null) } : current);
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
    <ScrollView contentContainerStyle={[styles.content, width < 540 && styles.contentNarrow]}>
      <View style={styles.document}>
        <Text style={styles.brandName}>SuperRH</Text>
        <View style={styles.intro}><Text style={styles.eyebrow}>Feedback</Text><Text style={styles.for}>Para {feedback.employee_name}</Text><Text style={styles.date}>{dateOnly(feedback.published_at)}</Text></View>
        <Text accessibilityRole="header" style={styles.title}>{feedback.title}</Text>
        <View style={styles.divider} />
        <Text style={styles.body}>{feedback.content}</Text>
        <View style={styles.divider} />
        <View style={styles.sender}><Text style={styles.senderName}>{feedback.created_by_name || feedback.company_name}</Text><Text style={styles.senderRole}>{senderRole(feedback.created_by_role)}</Text></View>
        <Button icon="download-outline" label="Baixar PDF" onPress={download} style={styles.pdfButton} variant="secondary" />
        {confirmed ? (
          <Animated.View accessibilityRole="alert" entering={FadeInDown.duration(motion.duracao('normal'))} style={styles.confirmed}>
            <Ionicons color={cores.status.sucesso.forte} name="checkmark" size={tamanho.iconeMedio} />
            <View style={styles.confirmedCopy}><Text style={styles.confirmedTitle}>Leitura confirmada</Text><Text style={styles.confirmedText}>Você confirmou em {dateTime(feedback.acknowledged_at!)}{feedback.acknowledgment_note ? ' e escreveu:' : '.'}</Text>{feedback.acknowledgment_note ? <View style={styles.noteBox}><Text selectable style={styles.noteText}>{feedback.acknowledgment_note}</Text></View> : null}<Text style={styles.confirmedHint}>Você pode continuar acessando este feedback e baixar o documento quando quiser.</Text></View>
          </Animated.View>
        ) : (
          <Animated.View exiting={FadeOut.duration(motion.duracao('instant'))} style={styles.confirmArea}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: saving }} disabled={saving} onPress={() => setChecked((current) => !current)} style={styles.checkboxRow}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Ionicons color={cores.texto.sobreAccent} name="checkmark" size={tamanho.iconePequeno} /> : null}</View>
              <Text style={styles.checkboxLabel}>Li e estou ciente deste feedback</Text>
            </Pressable>
            <Input
              accessibilityLabel="Observação opcional"
              editable={!saving}
              inputStyle={styles.noteInput}
              label="Quer deixar uma observação? (opcional)"
              maxLength={MAX_OBSERVACAO}
              multiline
              onChangeText={setNote}
              placeholder="Escreva aqui, se quiser. Você pode confirmar sem escrever nada."
              textAlignVertical="top"
              value={note}
            />
            <Text style={styles.noteCounter}>{note.length} de {MAX_OBSERVACAO}</Text>
            <Text style={styles.confirmHint}>A confirmação registra que você teve acesso ao conteúdo.</Text>
            <Button disabled={!checked} icon="checkmark-outline" label="Confirmar leitura" loading={saving} onPress={acknowledge} style={styles.confirmButton} />
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', backgroundColor: cores.superficie.elevada, flexGrow: 1, paddingHorizontal: espaco.xl, paddingTop: espaco.xxxl, paddingBottom: espaco.secao },
  contentNarrow: { paddingHorizontal: espaco.lg, paddingTop: espaco.xxl },
  loading: { padding: espaco.xl },
  loadingSkeleton: { height: espaco.secao },
  document: { alignSelf: 'stretch', maxWidth: 680, paddingBottom: espaco.secao },
  brandName: { ...tipografia.subtitulo, color: cores.texto.primario },
  intro: { marginTop: espaco.secao },
  eyebrow: { ...tipografia.rotulo, color: cores.texto.discreto, textTransform: 'uppercase' },
  for: { ...tipografia.subtitulo, color: cores.texto.primario, marginTop: espaco.md },
  date: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.micro },
  title: { ...tipografia.titulo, color: cores.texto.primario, marginTop: espaco.xxxl },
  divider: { backgroundColor: cores.borda.sutil, height: borda.fina, marginVertical: espaco.xxl },
  body: { ...tipografia.corpo, color: cores.texto.primario, fontSize: 16, lineHeight: 28 },
  sender: { gap: espaco.micro },
  senderName: { ...tipografia.corpoForte, color: cores.texto.primario },
  senderRole: { ...tipografia.corpo, color: cores.texto.discreto },
  pdfButton: { alignSelf: 'flex-start', marginTop: espaco.xxl },
  confirmArea: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, gap: espaco.md, marginTop: espaco.xxl, paddingTop: espaco.xxl },
  checkboxRow: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo },
  checkbox: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.controle, borderWidth: borda.fina, height: espaco.lg, justifyContent: 'center', width: espaco.lg },
  checkboxChecked: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  checkboxLabel: { ...tipografia.corpoForte, color: cores.texto.primario },
  confirmHint: { ...tipografia.corpo, color: cores.texto.discreto, maxWidth: 420 },
  confirmButton: { alignSelf: 'flex-start', marginTop: espaco.sm },
  confirmed: { alignItems: 'flex-start', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', gap: espaco.sm, marginTop: espaco.xxl, paddingTop: espaco.xxl },
  confirmedCopy: { flex: 1 },
  noteInput: { minHeight: espaco.tela * 2 },
  noteCounter: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  noteBox: { backgroundColor: cores.superficie.sutil, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, marginTop: espaco.md, padding: espaco.md },
  noteText: { ...tipografia.corpo, color: cores.texto.primario },
  confirmedTitle: { ...tipografia.corpoForte, color: cores.status.sucesso.forte },
  confirmedText: { ...tipografia.corpo, color: cores.texto.secundario, marginTop: espaco.micro },
  confirmedHint: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.md, maxWidth: 420 },
});
