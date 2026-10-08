import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { confirmarSalvo } from '../../helpers/confirmacaoSalvo';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../componentes/Button';
import { FeedbackForm } from '../../componentes/FeedbackForm';
import { createFeedback, publishFeedback } from '../../conexoes/feedbacks';
import { confirmAction } from '../../helpers/confirm';
import { useToast } from '../../contextos/Toast';
import type { CreateFeedbackData } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const EMPTY: CreateFeedbackData = { employee_id: 0, title: '', content: '' };

export default function NewFeedbackScreen() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [form, setForm] = useState<CreateFeedbackData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const narrow = width < 560;

  function validForm(): CreateFeedbackData | null {
    if (!form.employee_id || !form.title.trim() || !form.content.trim()) {
      toast.warning('Preencha colaborador, título e texto do feedback.');
      return null;
    }
    return { ...form, title: form.title.trim(), content: form.content.trim() };
  }

  async function saveDraft() {
    const data = validForm();
    if (!data) return;
    setSaving(true);
    try {
      const feedback = await createFeedback(data);
      toast.success('Rascunho salvo.');
      await confirmarSalvo();
      router.replace(`/feedbacks/${feedback.id}` as never);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível criar o feedback.');
    } finally { setSaving(false); }
  }

  function publish() {
    const data = validForm();
    if (!data) return;
    confirmAction(
      'Publicar feedback',
      'O colaborador receberá acesso por um link individual. Depois você poderá copiar o link, acompanhar a leitura, baixar o PDF e revogar o acesso.\n\nDeseja publicar?',
      async () => {
        setSaving(true);
        try {
          const draft = await createFeedback(data);
          await publishFeedback(draft.id);
          toast.success('Feedback publicado.');
          await confirmarSalvo();
          router.replace(`/feedbacks/${draft.id}` as never);
        } catch (error: any) {
          toast.error(error?.message ?? 'Não foi possível publicar o feedback.');
        } finally { setSaving(false); }
      },
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <Pressable accessibilityRole="link" onPress={() => router.back()} style={styles.back}><Ionicons color={cores.texto.secundario} name="arrow-back" size={tamanho.iconePequeno} /><Text style={styles.backText}>Feedbacks</Text></Pressable>
          <View style={styles.intro}><Text accessibilityRole="header" style={styles.heading}>Novo feedback</Text><Text style={styles.subtitle}>Envie um feedback individual para um colaborador.</Text></View>
          <View style={styles.formArea}><FeedbackForm disabled={saving} onChange={setForm} value={form} /></View>
          <View style={[styles.actions, narrow && styles.actionsNarrow]}>
            <Button disabled={saving} label="Salvar rascunho" onPress={saveDraft} style={narrow ? styles.fullAction : undefined} variant="secondary" />
            <Button disabled={saving} icon="send-outline" label="Publicar feedback" loading={saving} onPress={publish} style={narrow ? styles.fullAction : undefined} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: espaco.xl, paddingBottom: espaco.secao },
  page: { alignSelf: 'center', maxWidth: 720, width: '100%' },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: espaco.sm, minHeight: tamanho.toqueMinimo, marginBottom: espaco.xl },
  backText: { ...tipografia.corpoForte, color: cores.texto.secundario },
  intro: { marginBottom: espaco.xxxl },
  heading: { ...tipografia.display, color: cores.texto.primario },
  subtitle: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.xs },
  formArea: { borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, paddingBottom: espaco.xxxl },
  actions: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, justifyContent: 'flex-end', marginTop: espaco.xl },
  actionsNarrow: { alignItems: 'stretch', flexDirection: 'column-reverse' },
  fullAction: { width: '100%' },
});
