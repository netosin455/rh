// ============================================================
// app/(tabs)/reconhecimentos.tsx — Mural de Reconhecimento
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, ActivityIndicator, Alert,
  RefreshControl, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useToast } from '../../contextos/Toast';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getRecognitions, createRecognition, deleteRecognition } from '../../conexoes/reconhecimentos';
import { getEmployees } from '../../conexoes/colaboradores';
import { Recognition, Employee, RECOGNITION_CATEGORIES, RecognitionCategory } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

const CATEGORIES = Object.entries(RECOGNITION_CATEGORIES) as [RecognitionCategory, { label: string; icon: string; color: string }][];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m || 1}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function RecognitionsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [items,      setItems]      = useState<Recognition[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [empSearch,   setEmpSearch]   = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [category,    setCategory]    = useState<RecognitionCategory>('resultado');
  const [message,     setMessage]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [step,        setStep]        = useState<'pick' | 'write'>('pick');

  const load = useCallback(async () => {
    try {
      const res = await getRecognitions();
      setItems(res.data);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível carregar reconhecimentos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openModal() {
    try {
      const emps = await getEmployees();
      setEmployees(emps.filter(e => e.status !== 'desligado'));
    } catch { setEmployees([]); }
    setStep('pick');
    setSelectedEmp(null);
    setEmpSearch('');
    setCategory('resultado');
    setMessage('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selectedEmp || !message.trim()) return;
    setSaving(true);
    try {
      await createRecognition({ to_employee_id: selectedEmp.id, message: message.trim(), category });
      setModalOpen(false);
      toast.success('Reconhecimento publicado! 🏆');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível publicar o reconhecimento');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: Recognition) {
    const canDelete = ['super_admin', 'admin', 'rh', 'adm'].includes(user?.role ?? '') || r.from_user_id === (user as any)?.id;
    if (!canDelete) return;
    Alert.alert('Remover', 'Remover este reconhecimento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          try { await deleteRecognition(r.id); toast.success('Reconhecimento removido'); load(); }
          catch (e: any) { toast.error(e?.message ?? 'Não foi possível remover'); }
        },
      },
    ]);
  }

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.role_title.toLowerCase().includes(empSearch.toLowerCase())
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={theme.gold} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mural de Reconhecimento</Text>
            <Text style={styles.headerSub}>{total} reconhecimento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.kudosBtn} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={theme.bg} />
            <Text style={styles.kudosBtnText}>Dar Kudos</Text>
          </TouchableOpacity>
        </Animated.View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={44} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum reconhecimento ainda</Text>
            <Text style={styles.emptySub}>Seja o primeiro a celebrar alguém da equipe!</Text>
          </View>
        ) : (
          items.map((r, i) => {
            const cat = RECOGNITION_CATEGORIES[r.category] ?? RECOGNITION_CATEGORIES.outro;
            return (
              <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <TouchableOpacity
                  style={styles.card}
                  onLongPress={() => handleDelete(r)}
                  activeOpacity={0.9}
                >
                  {/* From → To */}
                  <View style={styles.cardTop}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: `${cat.color}22` }]}>
                        <Text style={[styles.avatarText, { color: cat.color }]}>{initials(r.from_name)}</Text>
                      </View>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={theme.textMuted} style={{ marginTop: 13 }} />
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatar, { backgroundColor: `${theme.gold}22` }]}>
                        <Text style={[styles.avatarText, { color: theme.gold }]}>{initials(r.to_name)}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.cardNames}>
                        <Text style={{ color: cat.color }}>{r.from_name}</Text>
                        <Text style={styles.cardNamesGray}> reconheceu </Text>
                        <Text style={{ color: theme.gold }}>{r.to_name}</Text>
                      </Text>
                      {r.to_role ? <Text style={styles.cardRole}>{r.to_role}</Text> : null}
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(r.created_at)}</Text>
                  </View>

                  {/* Category badge */}
                  <View style={[styles.catBadge, { backgroundColor: `${cat.color}18` }]}>
                    <Ionicons name={cat.icon as any} size={11} color={cat.color} />
                    <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
                  </View>

                  {/* Message */}
                  <Text style={styles.cardMessage}>"{r.message}"</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modal — criar reconhecimento */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === 'pick' ? 'Quem você quer reconhecer?' : `Reconhecer ${selectedEmp?.name.split(' ')[0]}`}
            </Text>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {step === 'pick' ? (
            <>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar colaborador..."
                placeholderTextColor={theme.textMuted}
                value={empSearch}
                onChangeText={setEmpSearch}
                autoFocus
              />
              <FlatList
                data={filteredEmps}
                keyExtractor={e => String(e.id)}
                renderItem={({ item: e }) => (
                  <TouchableOpacity
                    style={styles.empRow}
                    onPress={() => { setSelectedEmp(e); setStep('write'); }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.empAvatar}>
                      <Text style={styles.empInitials}>{initials(e.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{e.name}</Text>
                      <Text style={styles.empRole}>{e.role_title}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Category selector */}
              <Text style={styles.fieldLabel}>CATEGORIA</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={styles.catRow}>
                  {CATEGORIES.map(([key, val]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.catChip, category === key && { backgroundColor: `${val.color}25`, borderColor: val.color }]}
                      onPress={() => setCategory(key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={val.icon as any} size={13} color={category === key ? val.color : theme.textMuted} />
                      <Text style={[styles.catChipText, category === key && { color: val.color }]}>{val.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Message */}
              <Text style={styles.fieldLabel}>MENSAGEM</Text>
              <TextInput
                style={styles.messageInput}
                placeholder={`Escreva o que ${selectedEmp?.name.split(' ')[0]} fez de especial...`}
                placeholderTextColor={theme.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={styles.charCount}>{message.length}/500</Text>

              <TouchableOpacity
                style={[styles.saveBtn, (!message.trim() || saving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!message.trim() || saving}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator size="small" color={theme.bg} />
                  : <>
                      <Ionicons name="trophy" size={16} color={theme.bg} />
                      <Text style={styles.saveBtnText}>Publicar Reconhecimento</Text>
                    </>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('pick')}>
                <Text style={styles.backBtnText}>← Escolher outro colaborador</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content:  { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: theme.white },
  headerSub:    { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  kudosBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.gold, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  kudosBtnText: { fontSize: 13, fontWeight: '700', color: theme.bg },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
  emptySub:   { fontSize: 13, color: theme.textMuted, textAlign: 'center', paddingHorizontal: 32 },

  card: {
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 12,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  avatarWrap:  {},
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 12, fontWeight: '800' },
  cardNames:   { fontSize: 13, fontWeight: '700', color: theme.white, flexWrap: 'wrap' },
  cardNamesGray: { color: theme.textMuted, fontWeight: '400' },
  cardRole:    { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  cardTime:    { fontSize: 10, color: theme.textMuted, alignSelf: 'flex-start', marginTop: 2 },

  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  catText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  cardMessage: { fontSize: 13, color: theme.text, lineHeight: 20, fontStyle: 'italic' },

  // Modal
  modal:       { flex: 1, backgroundColor: theme.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: theme.white, flex: 1 },
  modalClose:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  searchInput: {
    margin: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface, color: theme.white, fontSize: 14,
  },

  empRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  empAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.goldDim, alignItems: 'center', justifyContent: 'center' },
  empInitials: { fontSize: 13, fontWeight: '700', color: theme.gold },
  empName:     { fontSize: 14, fontWeight: '600', color: theme.white, marginBottom: 1 },
  empRole:     { fontSize: 12, color: theme.textMuted },

  fieldLabel:   { fontSize: 9, color: theme.textMuted, fontWeight: '800', letterSpacing: 1.5, marginHorizontal: 16, marginBottom: 10 },
  catRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  catChipText:  { fontSize: 12, color: theme.textMuted, fontWeight: '600' },

  messageInput: {
    marginHorizontal: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface, color: theme.white, fontSize: 14, minHeight: 120,
  },
  charCount: { fontSize: 11, color: theme.textMuted, textAlign: 'right', marginHorizontal: 16, marginTop: 6, marginBottom: 20 },

  saveBtn:         { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.gold, paddingVertical: 14, borderRadius: 12 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontSize: 15, fontWeight: '800', color: theme.bg },
  backBtn:         { alignItems: 'center', marginTop: 14 },
  backBtnText:     { fontSize: 13, color: theme.textMuted },
});
