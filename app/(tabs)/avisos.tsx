import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getNotices, createNotice, deleteNotice, Notice } from '../../services/notices';
import { theme } from '../../theme';

const CAN_POST = ['super_admin', 'admin', 'rh', 'adm'];

const PRIORITY_CONFIG = {
  normal:     { label: 'Normal',     color: theme.textMuted,  bg: 'rgba(138,136,127,0.15)' },
  importante: { label: 'Importante', color: theme.warning,    bg: 'rgba(245,158,11,0.15)'  },
  urgente:    { label: 'Urgente',    color: theme.danger,     bg: 'rgba(224,82,82,0.15)'   },
} as const;

const PRIORITY_OPTIONS: { key: Notice['priority']; label: string }[] = [
  { key: 'normal',     label: 'Normal'     },
  { key: 'importante', label: 'Importante' },
  { key: 'urgente',    label: 'Urgente'    },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_FORM = { title: '', body: '', priority: 'normal' as Notice['priority'], pinned: false };

export default function AvisosScreen() {
  const { user } = useAuth();
  const canPost = CAN_POST.includes(user?.role ?? '');

  const [notices,    setNotices]    = useState<Notice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      setNotices(await getNotices());
    } catch (e) {
      console.error('[Avisos]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) return Alert.alert('Campo obrigatório', 'Informe o título.');
    if (!form.body.trim())  return Alert.alert('Campo obrigatório', 'Informe o texto do aviso.');

    setSaving(true);
    try {
      const created = await createNotice(form);
      setNotices(prev => [created, ...prev].sort((a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível publicar.');
    } finally {
      setSaving(false);
    }
  }

  function handleLongPress(notice: Notice) {
    if (!canPost) return;
    Alert.alert(
      'Excluir aviso',
      `Deseja excluir "${notice.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotice(notice.id);
              setNotices(prev => prev.filter(n => n.id !== notice.id));
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Não foi possível excluir.');
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {notices.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={44} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum aviso publicado</Text>
          </View>
        ) : (
          notices.map((notice, i) => {
            const pc = PRIORITY_CONFIG[notice.priority];
            return (
              <Animated.View key={notice.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <TouchableOpacity
                  style={[styles.card, notice.pinned && styles.cardPinned]}
                  onLongPress={() => handleLongPress(notice)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleRow}>
                      {notice.pinned && (
                        <Ionicons name="pin" size={13} color={theme.gold} style={styles.pinIcon} />
                      )}
                      <Text style={styles.cardTitle} numberOfLines={2}>{notice.title}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: pc.bg }]}>
                      <Text style={[styles.priorityText, { color: pc.color }]}>{pc.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardBody}>{notice.body}</Text>

                  <View style={styles.cardFooter}>
                    <Ionicons name="person-outline" size={11} color={theme.textMuted} />
                    <Text style={styles.cardMeta}>{notice.author_name}</Text>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Text style={styles.cardMeta}>{formatDate(notice.created_at)}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {canPost && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Aviso</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Reunião geral — sexta-feira"
              placeholderTextColor={theme.textMuted}
              value={form.title}
              onChangeText={v => set('title', v)}
            />

            <Text style={styles.label}>Texto *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Detalhe o aviso aqui..."
              placeholderTextColor={theme.textMuted}
              value={form.body}
              onChangeText={v => set('body', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Prioridade</Text>
            <View style={styles.chipGroup}>
              {PRIORITY_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.priority === o.key && styles.chipActive]}
                  onPress={() => set('priority', o.key)}
                >
                  <Text style={[styles.chipText, form.priority === o.key && styles.chipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.pinnedRow} onPress={() => set('pinned', !form.pinned)}>
              <Ionicons
                name={form.pinned ? 'pin' : 'pin-outline'}
                size={18}
                color={form.pinned ? theme.gold : theme.textMuted}
              />
              <Text style={[styles.pinnedLabel, form.pinned && { color: theme.gold }]}>
                Fixar no topo
              </Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowModal(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.btnSaveText}>Publicar</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  list:      { flex: 1 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  card: {
    margin: 12, marginBottom: 0,
    backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    padding: 16,
  },
  cardPinned: {
    borderColor: theme.border2,
    backgroundColor: theme.surface,
  },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinIcon:  { marginTop: 1 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.white },

  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText:  { fontSize: 10, fontWeight: '600' },

  cardBody:   { fontSize: 13, color: theme.textLight, lineHeight: 19, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta:   { fontSize: 11, color: theme.textMuted },
  cardMetaDot:{ fontSize: 11, color: theme.textMuted, marginHorizontal: 2 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: theme.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.gold, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  modal:       { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.white },
  modalBody:  { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  label: { fontSize: 11, color: theme.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, marginTop: 14, textTransform: 'uppercase' },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: theme.text,
  },
  inputMultiline: { minHeight: 100, paddingTop: 11 },

  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive:     { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  chipText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  chipTextActive: { color: theme.gold },

  pinnedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingVertical: 4 },
  pinnedLabel: { fontSize: 14, color: theme.textMuted },

  modalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  btnCancel:     { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  btnCancelText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  btnSave:       { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.gold, alignItems: 'center' },
  btnSaveText:   { fontSize: 14, fontWeight: '700', color: '#000' },
});
