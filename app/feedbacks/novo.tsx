import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { FeedbackForm } from '../../componentes/FeedbackForm';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { createFeedback } from '../../conexoes/feedbacks';
import { useToast } from '../../contextos/Toast';
import type { CreateFeedbackData } from '../../tipos/modelos';
import { espaco } from '../../estilo/espaco';

const EMPTY: CreateFeedbackData = { employee_id: 0, title: '', content: '' };

export default function NewFeedbackScreen() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<CreateFeedbackData>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.employee_id || !form.title.trim() || !form.content.trim()) return toast.warning('Preencha colaborador, título e texto do feedback.');
    setSaving(true);
    try {
      const feedback = await createFeedback({ ...form, title: form.title.trim(), content: form.content.trim() });
      toast.success('Rascunho criado. Revise e publique quando estiver pronto.');
      router.replace(`/feedbacks/${feedback.id}` as never);
    } catch (error: any) {
      toast.error(error?.message ?? 'Não foi possível criar o feedback.');
    } finally { setSaving(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Novo feedback" subtitle="O colaborador só terá acesso depois que você publicar o rascunho." />
        <Card>
          <FeedbackForm disabled={saving} onChange={setForm} value={form} />
          <View style={styles.actions}>
            <Button disabled={saving} label="Cancelar" onPress={() => router.back()} style={styles.action} variant="secondary" />
            <Button icon="save-outline" label="Salvar rascunho" loading={saving} onPress={save} style={styles.action} />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: espaco.xl, padding: espaco.xl, paddingBottom: espaco.secao },
  actions: { flexDirection: 'row', gap: espaco.md, marginTop: espaco.xl },
  action: { flex: 1 },
});
