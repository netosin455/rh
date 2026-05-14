// ============================================================
// app/pesquisas/index.tsx — Lista + Criar pesquisas de pulso
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
  Share, Switch, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getSurveys, createSurvey, deleteSurvey } from '../../conexoes/pesquisas';
import { PulseSurvey, CreateSurveyData } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';

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
  const [surveys,    setSurveys]    = useState<PulseSurvey[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState<CreateSurveyData>(EMPTY);
  const [optionText, setOptionText] = useState('');

  const load = useCallback(async () => {
    try {
      setSurveys(await getSurveys());
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar pesquisas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  function addOption() {
    const t = optionText.trim();
    if (!t) return;
    const opts = form.options ?? [];
    if (opts.length >= 6) return Alert.alert('Máximo de 6 opções');
    setForm(f => ({ ...f, options: [...(f.options ?? []), t] }));
    setOptionText('');
  }

  function removeOption(i: number) {
    setForm(f => ({ ...f, options: (f.options ?? []).filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.question.trim()) {
      return Alert.alert('Preencha', 'Título e pergunta são obrigatórios');
    }
    if (form.type === 'choice' && (!form.options || form.options.length < 2)) {
      return Alert.alert('Atenção', 'Adicione ao menos 2 opções de resposta');
    }
    setSaving(true);
    try {
      await createSurvey({ ...form, title: form.title.trim(), question: form.question.trim() });
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível criar pesquisa');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: PulseSurvey) {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Excluir "${s.title}"?`)) return;
      try {
        await deleteSurvey(s.id);
        load();
      } catch (e: any) {
        window.alert(e?.message ?? 'Erro ao excluir pesquisa');
      }
      return;
    }
    Alert.alert('Excluir', `Excluir "${s.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await deleteSurvey(s.id);
            load();
          } catch (e: any) {
            Alert.alert('Erro', e?.message);
          }
        },
      },
    ]);
  }

  function shareLink(s: PulseSurvey) {
    const link = `${API_URL.replace('/api', '')}/responder/${s.id}`.replace('undefined', 'https://super-rh.vercel.app');
    Share.share({ message: `📊 ${s.title}\n\n${s.question}\n\nResponda aqui: ${link}` });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pesquisas de Pulso</Text>
          <Text style={styles.headerSub}>{surveys.length} pesquisa{surveys.length !== 1 ? 's' : ''} criada{surveys.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(v => !v)}>
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color={theme.bg} />
          <Text style={styles.newBtnText}>{showForm ? 'Cancelar' : 'Nova'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Formulário de criação */}
      {showForm && (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.formCard}>
          <Text style={styles.formTitle}>Nova Pesquisa</Text>

          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Clima organizacional — Maio"
            placeholderTextColor={theme.textMuted}
            value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))}
          />

          <Text style={styles.label}>Pergunta</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="Ex: Como você avalia o ambiente de trabalho esta semana?"
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={3}
            value={form.question}
            onChangeText={v => setForm(f => ({ ...f, question: v }))}
          />

          {/* Tipo */}
          <Text style={styles.label}>Tipo de resposta</Text>
          <View style={styles.typeRow}>
            {(['scale', 'choice'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
                onPress={() => setForm(f => ({ ...f, type: t, options: t === 'scale' ? null : f.options }))}
              >
                <Ionicons
                  name={t === 'scale' ? 'stats-chart' : 'list'}
                  size={14}
                  color={form.type === t ? theme.bg : theme.gold}
                />
                <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                  {t === 'scale' ? 'Escala 1-5' : 'Múltipla Escolha'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Opções (choice) */}
          {form.type === 'choice' && (
            <View>
              <Text style={styles.label}>Opções de resposta</Text>
              {(form.options ?? []).map((o, i) => (
                <View key={i} style={styles.optionRow}>
                  <View style={styles.optionDot} />
                  <Text style={styles.optionText}>{o}</Text>
                  <TouchableOpacity onPress={() => removeOption(i)}>
                    <Ionicons name="close-circle" size={18} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.optionInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Nova opção…"
                  placeholderTextColor={theme.textMuted}
                  value={optionText}
                  onChangeText={setOptionText}
                  onSubmitEditing={addOption}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
                  <Ionicons name="add" size={20} color={theme.gold} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Data de expiração */}
          <Text style={styles.label}>Encerrar em (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.textMuted}
            value={form.expires_at ?? ''}
            onChangeText={v => setForm(f => ({ ...f, expires_at: v || null }))}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={theme.bg} size="small" />
              : <Text style={styles.saveBtnText}>Criar Pesquisa</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Lista */}
      {surveys.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <Ionicons name="clipboard-outline" size={40} color={theme.textMuted} />
          <Text style={styles.emptyText}>Nenhuma pesquisa criada ainda</Text>
          <Text style={styles.emptySub}>Crie uma pesquisa para coletar feedback da equipe</Text>
        </View>
      ) : (
        surveys.map((s, i) => {
          const expired = s.expires_at && new Date(s.expires_at) < new Date();
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).duration(300)} style={[styles.card, expired && styles.cardExpired]}>
              <TouchableOpacity
                style={styles.cardTop}
                onPress={() => router.push(`/pesquisas/${s.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.typeIcon, { backgroundColor: s.type === 'scale' ? `${theme.info}18` : `${theme.success}18` }]}>
                  <Ionicons
                    name={s.type === 'scale' ? 'stats-chart' : 'list'}
                    size={16}
                    color={s.type === 'scale' ? theme.info : theme.success}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardQuestion} numberOfLines={2}>{s.question}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.metaText}>{s.response_count ?? 0} resposta{(s.response_count ?? 0) !== 1 ? 's' : ''}</Text>
                </View>
                {s.dept_name ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{s.dept_name}</Text>
                  </View>
                ) : (
                  <View style={styles.metaItem}>
                    <Ionicons name="globe-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>Toda empresa</Text>
                  </View>
                )}
                {s.expires_at && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color={expired ? theme.danger : theme.textMuted} />
                    <Text style={[styles.metaText, expired && { color: theme.danger }]}>{daysLeft(s.expires_at)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => shareLink(s)}>
                  <Ionicons name="share-social-outline" size={15} color={theme.gold} />
                  <Text style={styles.actionText}>Compartilhar link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/pesquisas/${s.id}` as any)}>
                  <Ionicons name="bar-chart-outline" size={15} color={theme.info} />
                  <Text style={[styles.actionText, { color: theme.info }]}>Ver resultados</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(s)}>
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.white },
  headerSub:  { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  newBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.gold, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  newBtnText: { fontSize: 13, fontWeight: '700', color: theme.bg },

  formCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 16,
  },
  formTitle: { fontSize: 15, fontWeight: '800', color: theme.gold, marginBottom: 14 },
  label:     { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    color: theme.white, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  typeRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  typeBtnActive:  { backgroundColor: theme.gold, borderColor: theme.gold },
  typeBtnText:    { fontSize: 13, fontWeight: '600', color: theme.gold },
  typeBtnTextActive: { color: theme.bg },

  optionRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.gold },
  optionText:     { flex: 1, fontSize: 14, color: theme.text },
  optionInputRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  addOptionBtn:   { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },

  saveBtn:     { backgroundColor: theme.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: theme.bg },

  empty:     { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
  emptySub:  { fontSize: 13, color: theme.textMuted, textAlign: 'center', paddingHorizontal: 32 },

  card: {
    backgroundColor: 'rgba(24,27,33,0.92)', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    marginBottom: 12, overflow: 'hidden',
  },
  cardExpired: { opacity: 0.6 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  typeIcon:   { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: theme.white, marginBottom: 2 },
  cardQuestion: { fontSize: 12, color: theme.textMuted },

  cardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 11, color: theme.textMuted },

  cardActions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  actionText: { fontSize: 12, color: theme.gold, fontWeight: '600' },
});
