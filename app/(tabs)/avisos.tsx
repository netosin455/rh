// ============================================================
// app/(tabs)/avisos.tsx — Mural de Avisos
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { getNotices, createNotice, pinNotice, deleteNotice } from '../../conexoes/avisos';
import { Notice, CreateNoticeData, NoticePriority, NOTICE_PRIORITY_LABELS } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';

const PRIORITY_COLORS: Record<NoticePriority, string> = {
  normal:     theme.info,
  importante: theme.warning,
  urgente:    theme.danger,
};

const PRIORITY_ICONS: Record<NoticePriority, keyof typeof Ionicons.glyphMap> = {
  normal:     'information-circle-outline',
  importante: 'warning-outline',
  urgente:    'alert-circle-outline',
};

const PRIORITY_OPTIONS: { key: NoticePriority; label: string }[] = [
  { key: 'normal',     label: 'Normal' },
  { key: 'importante', label: 'Importante' },
  { key: 'urgente',    label: 'Urgente' },
];

const EMPTY_FORM = {
  title:      '',
  body:       '',
  priority:   'normal' as NoticePriority,
  pinned:     false,
  expires_at: '',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d atrás`;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function AvisosScreen() {
  const { user } = useAuth();
  const canManage = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  const [notices,    setNotices]    = useState<Notice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [expanded,   setExpanded]   = useState<number | null>(null);
  const [formError,  setFormError]  = useState('');

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

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.title.trim()) { setFormError('Informe o título do aviso.'); return; }
    if (!form.body.trim())  { setFormError('Informe o conteúdo do aviso.'); return; }

    setSaving(true);
    try {
      const data: CreateNoticeData = {
        title:      form.title.trim(),
        body:       form.body.trim(),
        priority:   form.priority,
        pinned:     form.pinned,
        expires_at: form.expires_at || undefined,
      };
      const created = await createNotice(data);
      setNotices(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePin(n: Notice) {
    try {
      const updated = await pinNotice(n.id, !n.pinned);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, pinned: updated.pinned } : x));
    } catch (e: any) {
      console.error('[handlePin]', e.message);
    }
  }

  async function handleDelete(n: Notice) {
    const confirmed = window.confirm(`Excluir o aviso "${n.title}"?`);
    if (!confirmed) return;
    try {
      await deleteNotice(n.id);
      setNotices(prev => prev.filter(x => x.id !== n.id));
    } catch (e: any) {
      console.error('[handleDelete]', e.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  const pinned   = notices.filter(n => n.pinned);
  const unpinned = notices.filter(n => !n.pinned);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {notices.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={44} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum aviso publicado</Text>
            {canManage && (
              <Text style={styles.emptyText}>Toque em + para publicar um aviso</Text>
            )}
          </View>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="pin" size={12} color={theme.gold} />
                  <Text style={styles.sectionTitle}>Fixados</Text>
                  <Text style={styles.sectionCount}>{pinned.length}</Text>
                </View>
                {pinned.map((n, i) => (
                  <NoticeCard
                    key={n.id} notice={n} index={i}
                    expanded={expanded === n.id} canManage={canManage}
                    onToggle={() => setExpanded(prev => prev === n.id ? null : n.id)}
                    onPin={() => handlePin(n)}
                    onDelete={() => handleDelete(n)}
                  />
                ))}
              </>
            )}

            {unpinned.length > 0 && (
              <>
                {pinned.length > 0 && (
                  <View style={styles.sectionHeader}>
                    <Ionicons name="list-outline" size={12} color={theme.textMuted} />
                    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Todos os avisos</Text>
                    <Text style={[styles.sectionCount, { color: theme.textMuted }]}>{unpinned.length}</Text>
                  </View>
                )}
                {unpinned.map((n, i) => (
                  <NoticeCard
                    key={n.id} notice={n} index={i}
                    expanded={expanded === n.id} canManage={canManage}
                    onToggle={() => setExpanded(prev => prev === n.id ? null : n.id)}
                    onPin={() => handlePin(n)}
                    onDelete={() => handleDelete(n)}
                  />
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {canManage && (
        <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Novo Aviso</Text>
              <Text style={styles.modalSubtitle}>Publicar para toda a equipe</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Título *</Text>
            <TextInput style={styles.input} placeholder="Assunto do aviso" placeholderTextColor={theme.textMuted} value={form.title} onChangeText={v => setF('title', v)} />

            <Text style={styles.label}>Conteúdo *</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Escreva o aviso aqui..."
              placeholderTextColor={theme.textMuted}
              value={form.body}
              onChangeText={v => setF('body', v)}
              multiline
            />

            <Text style={styles.label}>Prioridade</Text>
            <View style={styles.chipGroup}>
              {PRIORITY_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.priority === o.key && styles.chipActive, form.priority === o.key && { borderColor: PRIORITY_COLORS[o.key] }]}
                  onPress={() => setF('priority', o.key)}
                >
                  <Ionicons name={PRIORITY_ICONS[o.key]} size={12} color={form.priority === o.key ? PRIORITY_COLORS[o.key] : theme.textMuted} />
                  <Text style={[styles.chipText, form.priority === o.key && { color: PRIORITY_COLORS[o.key] }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Opções</Text>
            <TouchableOpacity
              style={[styles.toggleRow, form.pinned && styles.toggleRowActive]}
              onPress={() => setF('pinned', !form.pinned)}
            >
              <Ionicons name={form.pinned ? 'pin' : 'pin-outline'} size={16} color={form.pinned ? theme.gold : theme.textMuted} />
              <Text style={[styles.toggleText, form.pinned && styles.toggleTextActive]}>Fixar no topo</Text>
              {form.pinned && <Ionicons name="checkmark" size={14} color={theme.gold} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <Text style={styles.label}>Válido até (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2025-12-31 (deixe em branco para não expirar)"
              placeholderTextColor={theme.textMuted}
              value={form.expires_at}
              onChangeText={v => setF('expires_at', v)}
              keyboardType="numeric" maxLength={10}
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          {formError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

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

function NoticeCard({
  notice, index, expanded, canManage, onToggle, onPin, onDelete,
}: {
  notice: Notice; index: number; expanded: boolean;
  canManage: boolean; onToggle: () => void; onPin: () => void; onDelete: () => void;
}) {
  const color = PRIORITY_COLORS[notice.priority];
  const icon  = PRIORITY_ICONS[notice.priority];

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <TouchableOpacity
        style={[styles.noticeCard, notice.pinned && styles.noticePinned]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={[styles.priorityBar, { backgroundColor: color }]} />
        <View style={styles.noticeContent}>
          <View style={styles.noticeTop}>
            <View style={[styles.priorityBadge, { backgroundColor: `${color}18` }]}>
              <Ionicons name={icon} size={11} color={color} />
              <Text style={[styles.priorityLabel, { color }]}>
                {NOTICE_PRIORITY_LABELS[notice.priority]}
              </Text>
            </View>
            {notice.pinned && (
              <Ionicons name="pin" size={11} color={theme.gold} />
            )}
            <Text style={styles.noticeTime}>{timeAgo(notice.created_at)}</Text>
          </View>

          <Text style={styles.noticeTitle}>{notice.title}</Text>

          {expanded ? (
            <Text style={styles.noticeBody}>{notice.body}</Text>
          ) : (
            <Text style={styles.noticeBodyPreview} numberOfLines={2}>{notice.body}</Text>
          )}

          <View style={styles.noticeFooter}>
            <Text style={styles.noticeAuthor}>{notice.author_name ?? 'RH'}</Text>
            <View style={styles.noticeRight}>
              <Text style={[styles.expandHint, { color: expanded ? theme.textMuted : theme.gold }]}>
                {expanded ? 'Recolher' : 'Ler mais'}
              </Text>
              {canManage && (
                <View style={styles.noticeActions}>
                  <TouchableOpacity onPress={onPin} style={styles.actionBtn}>
                    <Ionicons name={notice.pinned ? 'pin' : 'pin-outline'} size={15} color={theme.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={15} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  list: { flex: 1 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: theme.textLight },
  emptyText:  { fontSize: 13, color: theme.textMuted },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  sectionTitle: { fontSize: 11, color: theme.gold, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  sectionCount: { fontSize: 11, color: theme.gold, fontWeight: '600', backgroundColor: theme.goldDim, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },

  noticeCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  noticePinned:  { backgroundColor: theme.goldGlow },
  priorityBar:   { width: 4 },
  noticeContent: { flex: 1, padding: 14, gap: 6 },

  noticeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
  },
  priorityLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  noticeTime:    { fontSize: 10, color: theme.textMuted, marginLeft: 'auto' },

  noticeTitle:       { fontSize: 14, fontWeight: '700', color: theme.white },
  noticeBody:        { fontSize: 13, color: theme.text, lineHeight: 20 },
  noticeBodyPreview: { fontSize: 13, color: theme.textLight, lineHeight: 18 },

  noticeFooter:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  noticeAuthor:  { fontSize: 11, color: theme.textMuted },
  noticeRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandHint:    { fontSize: 11, fontWeight: '600' },
  noticeActions: { flexDirection: 'row', gap: 2 },
  actionBtn:     { padding: 5 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: theme.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.gold, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  modal:       { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  modalTitle:    { fontSize: 17, fontWeight: '700', color: theme.white },
  modalSubtitle: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  modalClose:    { padding: 2 },
  modalBody:     { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  label: {
    fontSize: 11, color: theme.textMuted, fontWeight: '600',
    letterSpacing: 0.5, marginBottom: 6, marginTop: 14, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: theme.text,
  },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive:     { backgroundColor: theme.surface2 },
  chipText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  chipTextActive: { color: theme.gold },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 13, borderRadius: 8, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  toggleRowActive:  { backgroundColor: theme.goldGlow, borderColor: theme.border2 },
  toggleText:       { fontSize: 13, color: theme.textMuted, flex: 1 },
  toggleTextActive: { color: theme.gold },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,82,82,0.08)', borderTopWidth: 1, borderTopColor: 'rgba(224,82,82,0.2)',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  errorText: { fontSize: 13, color: theme.danger, flex: 1 },

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
