// ============================================================
// app/(tabs)/processos.tsx — Processos Jurídicos
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { getCases, createCase, deleteCase } from '../../conexoes/casos';
import { getEmployees } from '../../conexoes/colaboradores';
import {
  LegalCase, CaseArea, CaseStatus, CreateCaseData,
  CASE_STATUS_LABELS, CASE_AREA_LABELS,
} from '../../tipos/modelos';
import { theme } from '../../estilo/cores';

const STATUS_COLORS: Record<CaseStatus, string> = {
  ativo:     theme.success,
  andamento: theme.info,
  suspenso:  theme.warning,
  encerrado: theme.textMuted,
  urgente:   theme.danger,
};

const AREA_COLORS: Record<CaseArea, string> = {
  civel:       theme.gold,
  trabalhista: theme.info,
  tributario:  theme.danger,
  familia:     '#9B72CF',
  criminal:    '#E8955A',
  empresarial: theme.success,
  outro:       theme.textMuted,
};

const STATUS_FILTERS: { key: CaseStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'urgente',  label: 'Urgente' },
  { key: 'ativo',    label: 'Ativo' },
  { key: 'andamento',label: 'Andamento' },
  { key: 'suspenso', label: 'Suspenso' },
  { key: 'encerrado',label: 'Encerrado' },
];

const AREA_OPTIONS: { key: CaseArea; label: string }[] = Object.entries(CASE_AREA_LABELS).map(
  ([key, label]) => ({ key: key as CaseArea, label }),
);

const STATUS_OPTIONS: { key: CaseStatus; label: string }[] = Object.entries(CASE_STATUS_LABELS).map(
  ([key, label]) => ({ key: key as CaseStatus, label }),
);

const EMPTY_FORM = {
  case_number: '',
  title:       '',
  client_name: '',
  area:        'civel' as CaseArea,
  status:      'ativo' as CaseStatus,
  court:       '',
  deadline:    '',
  description: '',
  responsible_id: undefined as number | undefined,
};

function formatDeadline(d?: string): string | null {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return day ? `${day}/${m}/${y}` : d;
}

function isExpired(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function ProcessosScreen() {
  const { user } = useAuth();
  const router   = useRouter();
  const canManage = ['super_admin','admin','rh','adm','juridico','gestor'].includes(user?.role ?? '');

  const [cases,      setCases]      = useState<LegalCase[]>([]);
  const [employees,  setEmployees]  = useState<{ id: number; name: string }[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<CaseStatus | 'todos'>('todos');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([getCases(), getEmployees()]);
      setCases(c);
      setEmployees(e.map(emp => ({ id: emp.id, name: emp.name })));
    } catch (e) {
      console.error('[Processos]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cases.filter(c => {
      const matchStatus = filter === 'todos' || c.status === filter;
      const matchSearch = !q ||
        c.title.toLowerCase().includes(q) ||
        c.case_number.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [cases, filter, search]);

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.case_number.trim()) return Alert.alert('Campo obrigatório', 'Informe o número do processo.');
    if (!form.title.trim())       return Alert.alert('Campo obrigatório', 'Informe o título.');
    if (!form.client_name.trim()) return Alert.alert('Campo obrigatório', 'Informe o cliente.');

    setSaving(true);
    try {
      const data: CreateCaseData = {
        case_number:    form.case_number.trim(),
        title:          form.title.trim(),
        client_name:    form.client_name.trim(),
        area:           form.area,
        status:         form.status,
        court:          form.court.trim() || undefined,
        deadline:       form.deadline || undefined,
        description:    form.description.trim() || undefined,
        responsible_id: form.responsible_id,
      };
      const created = await createCase(data);
      setCases(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(c: LegalCase) {
    Alert.alert(
      'Excluir processo',
      `Deseja excluir "${c.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            try {
              await deleteCase(c.id);
              setCases(prev => prev.filter(x => x.id !== c.id));
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

  const urgentCount = cases.filter(c => c.status === 'urgente').length;

  return (
    <View style={styles.container}>
      {urgentCount > 0 && (
        <View style={styles.urgentBanner}>
          <Ionicons name="alert-circle" size={14} color={theme.danger} />
          <Text style={styles.urgentText}>{urgentCount} processo{urgentCount > 1 ? 's' : ''} urgente{urgentCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título, número ou cliente..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterRow} contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.countLabel}>{filtered.length} processo{filtered.length !== 1 ? 's' : ''}</Text>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum processo encontrado</Text>
          </View>
        ) : (
          filtered.map((c, i) => {
            const expired = isExpired(c.deadline);
            return (
              <Animated.View key={c.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <TouchableOpacity
                  style={styles.caseRow}
                  onLongPress={() => canManage && handleDelete(c)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.areaBar, { backgroundColor: AREA_COLORS[c.area] }]} />
                  <View style={styles.caseBody}>
                    <View style={styles.caseTop}>
                      <Text style={styles.caseNumber}>{c.case_number}</Text>
                      <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[c.status]}20` }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[c.status] }]}>
                          {CASE_STATUS_LABELS[c.status]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.caseTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.caseClient} numberOfLines={1}>
                      <Ionicons name="person-outline" size={11} color={theme.textMuted} /> {c.client_name}
                    </Text>
                    <View style={styles.caseMeta}>
                      <Text style={styles.caseArea}>{CASE_AREA_LABELS[c.area]}</Text>
                      {c.deadline && (
                        <Text style={[styles.caseDeadline, expired && styles.caseDeadlineExpired]}>
                          <Ionicons name="time-outline" size={11} /> {formatDeadline(c.deadline)}
                          {expired ? ' (vencido)' : ''}
                        </Text>
                      )}
                      {c.responsible_name && (
                        <Text style={styles.caseResponsible}>{c.responsible_name}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {canManage && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      )}

      {/* Modal de cadastro */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Processo</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Número do Processo *</Text>
            <TextInput style={styles.input} placeholder="0012847-23.2024.8.26.0100" placeholderTextColor={theme.textMuted} value={form.case_number} onChangeText={v => set('case_number', v)} />

            <Text style={styles.label}>Título *</Text>
            <TextInput style={styles.input} placeholder="Breve descrição do processo" placeholderTextColor={theme.textMuted} value={form.title} onChangeText={v => set('title', v)} />

            <Text style={styles.label}>Cliente *</Text>
            <TextInput style={styles.input} placeholder="Nome do cliente" placeholderTextColor={theme.textMuted} value={form.client_name} onChangeText={v => set('client_name', v)} />

            <Text style={styles.label}>Área</Text>
            <View style={styles.chipGroup}>
              {AREA_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.area === o.key && styles.chipActive]}
                  onPress={() => set('area', o.key)}
                >
                  <Text style={[styles.chipText, form.area === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Status</Text>
            <View style={styles.chipGroup}>
              {STATUS_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.status === o.key && styles.chipActive]}
                  onPress={() => set('status', o.key)}
                >
                  <Text style={[styles.chipText, form.status === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Vara / Tribunal</Text>
            <TextInput style={styles.input} placeholder="Ex: 2ª Vara Cível de SP" placeholderTextColor={theme.textMuted} value={form.court} onChangeText={v => set('court', v)} />

            <Text style={styles.label}>Prazo (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2025-12-31" placeholderTextColor={theme.textMuted} value={form.deadline} onChangeText={v => set('deadline', v)} keyboardType="numeric" maxLength={10} />

            <Text style={styles.label}>Responsável</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={[styles.chipGroup, { flexWrap: 'nowrap' }]}>
                {employees.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.chip, form.responsible_id === e.id && styles.chipActive]}
                    onPress={() => set('responsible_id', form.responsible_id === e.id ? undefined : e.id)}
                  >
                    <Text style={[styles.chipText, form.responsible_id === e.id && styles.chipTextActive]}>{e.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Detalhes do processo..."
              placeholderTextColor={theme.textMuted}
              value={form.description}
              onChangeText={v => set('description', v)}
              multiline
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowModal(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.btnSaveText}>Salvar</Text>
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

  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${theme.danger}15`, paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: `${theme.danger}30`,
  },
  urgentText: { fontSize: 12, color: theme.danger, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderBottomWidth: 1,
    borderBottomColor: theme.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.text },

  filterRow:     { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: theme.border },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  filterChipActive: { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  filterText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  filterTextActive: { color: theme.gold },

  countLabel: { fontSize: 11, color: theme.textMuted, paddingHorizontal: 16, paddingVertical: 8 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  caseRow: {
    flexDirection: 'row', backgroundColor: theme.bg,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  areaBar:  { width: 4 },
  caseBody: { flex: 1, padding: 14, gap: 3 },
  caseTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  caseNumber:    { fontSize: 10, color: theme.textMuted, fontFamily: 'monospace', flex: 1, marginRight: 8 },
  statusPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText:    { fontSize: 10, fontWeight: '600' },
  caseTitle:     { fontSize: 14, fontWeight: '600', color: theme.text },
  caseClient:    { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  caseMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  caseArea:      { fontSize: 10, color: theme.gold, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  caseDeadline:  { fontSize: 10, color: theme.textMuted },
  caseDeadlineExpired: { color: theme.danger },
  caseResponsible: { fontSize: 10, color: theme.textLight },

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
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive:     { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  chipText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  chipTextActive: { color: theme.gold },

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
