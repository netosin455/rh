// ============================================================
// app/pesquisas/index.tsx — Lista + Criar pesquisas de pulso
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { getSurveys, createSurvey, deleteSurvey } from '../../conexoes/pesquisas';
import { confirmAction } from '../../helpers/confirm';
import { PulseSurvey, CreateSurveyData } from '../../tipos/modelos';
import { useToast } from '../../contextos/Toast';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const EMPTY: CreateSurveyData = {
  title:      '',
  question:   '',
  type:       'scale',
  options:    null,
  target_dept: null,
  expires_at: null,
};

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
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState<CreateSurveyData>(EMPTY);
  const [optionText, setOptionText] = useState('');
  const [latestCreatedId, setLatestCreatedId] = useState<number | null>(null);

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

  function closeForm() {
    if (!saving) setShowForm(false);
  }

  function addOption() {
    const t = optionText.trim();
    if (!t) return;
    const opts = form.options ?? [];
    if (opts.length >= 6) return toast.warning('Máximo de 6 opções de resposta');
    setForm(f => ({ ...f, options: [...(f.options ?? []), t] }));
    setOptionText('');
  }

  function removeOption(i: number) {
    setForm(f => ({ ...f, options: (f.options ?? []).filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.question.trim()) {
      return toast.warning('Título e pergunta são obrigatórios');
    }
    if (form.type === 'choice' && (!form.options || form.options.length < 2)) {
      return toast.warning('Adicione ao menos 2 opções de resposta');
    }
    setSaving(true);
    try {
      const created = await createSurvey({ ...form, title: form.title.trim(), question: form.question.trim() });
      setLatestCreatedId(created.id);
      setForm(EMPTY);
      setShowForm(false);
      load();
      toast.success('Pesquisa criada com sucesso!');
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível criar pesquisa');
    } finally {
      setSaving(false);
    }
  }

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
    Share.share({ message: `${s.title}\n\n${s.question}\n\nResponda aqui: ${link}` });
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
          action={<Button icon="add-outline" label="Nova pesquisa" onPress={() => setShowForm(true)} />}
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
              action={<Button icon="add-outline" label="Criar pesquisa" onPress={() => setShowForm(true)} />}
            />
          ) : (
            <View style={styles.surveyList}>
              {surveys.map((survey) => {
                const expired = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
                const responseCount = survey.response_count ?? 0;
                return (
                  <Animated.View entering={survey.id === latestCreatedId ? newSurveyEntering : undefined} key={survey.id}>
                    <Card padded={false} style={expired ? styles.expiredCard : undefined}>
                      <ListRow
                        accessibilityLabel={`Ver resultados de ${survey.title}`}
                        description={survey.question}
                        onPress={() => router.push(`/pesquisas/${survey.id}` as any)}
                        title={survey.title}
                        trailing={(
                          <View style={styles.rowBadges}>
                            <Badge label={survey.type === 'scale' ? 'Escala 1–5' : 'Múltipla escolha'} tone={survey.type === 'scale' ? 'info' : 'success'} />
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

      <Modal
        footer={(
          <View style={styles.footerActions}>
            <Button disabled={saving} label="Cancelar" onPress={closeForm} style={styles.footerButton} variant="secondary" />
            <Button label="Criar pesquisa" loading={saving} onPress={handleSave} style={styles.footerButton} />
          </View>
        )}
        onClose={closeForm}
        subtitle="Defina uma pergunta e como a equipe poderá respondê-la."
        title="Nova pesquisa"
        visible={showForm}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Input
              editable={!saving}
              label="Título"
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
              placeholder="Ex.: Clima organizacional — Maio"
              value={form.title}
            />
            <Input
              editable={!saving}
              inputStyle={styles.multilineInput}
              label="Pergunta"
              multiline
              numberOfLines={3}
              onChangeText={(value) => setForm((current) => ({ ...current, question: value }))}
              placeholder="Como você avalia o ambiente de trabalho esta semana?"
              textAlignVertical="top"
              value={form.question}
            />
            <Section title="Tipo de resposta">
              <View style={styles.typeRow}>
                {(['scale', 'choice'] as const).map((type) => {
                  const selected = form.type === type;
                  return (
                    <Button
                      disabled={saving}
                      icon={type === 'scale' ? 'stats-chart-outline' : 'list-outline'}
                      key={type}
                      label={type === 'scale' ? 'Escala 1–5' : 'Múltipla escolha'}
                      onPress={() => setForm((current) => ({ ...current, type, options: type === 'scale' ? null : current.options }))}
                      style={styles.typeButton}
                      variant={selected ? 'primary' : 'secondary'}
                    />
                  );
                })}
              </View>
            </Section>

            {form.type === 'choice' ? (
              <Section title="Opções de resposta" description="Adicione entre duas e seis opções.">
                {(form.options ?? []).length > 0 ? (
                  <Card padded={false}>
                    {(form.options ?? []).map((option, index) => (
                      <ListRow
                        key={`${option}-${index}`}
                        title={option}
                        trailing={<Button accessibilityLabel={`Remover opção ${option}`} icon="close-outline" onPress={() => removeOption(index)} variant="danger" />}
                      />
                    ))}
                  </Card>
                ) : null}
                <Input
                  editable={!saving}
                  label="Nova opção"
                  onChangeText={setOptionText}
                  onSubmitEditing={addOption}
                  placeholder="Digite uma opção"
                  returnKeyType="done"
                  rightAccessory={<Button accessibilityLabel="Adicionar opção" disabled={saving} icon="add-outline" onPress={addOption} variant="ghost" />}
                  value={optionText}
                />
              </Section>
            ) : null}

            <Input
              editable={!saving}
              label="Encerrar em (opcional)"
              onChangeText={(value) => setForm((current) => ({ ...current, expires_at: value || null }))}
              placeholder="AAAA-MM-DD"
              value={form.expires_at ?? ''}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  footerActions: { flexDirection: 'row', gap: espaco.md },
  footerButton: { flex: 1 },
  form: { gap: espaco.lg, paddingBottom: espaco.xs },
  multilineInput: { minHeight: espaco.secao },
  typeRow: { flexDirection: 'row', gap: espaco.sm },
  typeButton: { flex: 1 },
});
