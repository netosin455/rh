import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAbsences, approveAbsence, createAbsence } from '../../conexoes/ausencias';
import { getEmployees } from '../../conexoes/colaboradores';
import { Absence, AbsenceStatus, AbsenceType, ABSENCE_TYPE_LABELS, CreateAbsenceData, Employee } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';
import { formatDateShort } from '../../helpers/datas';

const STATUS_COLORS: Record<AbsenceStatus, string> = {
  pendente:  theme.warning,
  aprovado:  theme.success,
  recusado:  theme.danger,
  cancelado: theme.textMuted,
};

const STATUS_LABELS: Record<AbsenceStatus, string> = {
  pendente:  'Pendente',
  aprovado:  'Aprovado',
  recusado:  'Recusado',
  cancelado: 'Cancelado',
};

const FILTER_TABS: { key: AbsenceStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aprovado', label: 'Aprovados' },
  { key: 'recusado', label: 'Recusados' },
];

const TYPE_OPTIONS: { key: AbsenceType; label: string }[] = [
  { key: 'ferias',              label: 'Férias' },
  { key: 'licenca_medica',      label: 'Licença Médica' },
  { key: 'licenca_maternidade', label: 'Lic. Maternidade' },
  { key: 'licenca_paternidade', label: 'Lic. Paternidade' },
  { key: 'folga',               label: 'Folga' },
  { key: 'outro',               label: 'Outro' },
];

const EMPTY_FORM = {
  employee_id: 0,
  type:        'ferias' as AbsenceType,
  start_date:  '',
  end_date:    '',
  reason:      '',
  status:      'pendente' as AbsenceStatus,
};

export default function FeriasScreen() {
  const { user } = useAuth();
  const canApprove = ['super_admin','admin','rh','adm','gestor'].includes(user?.role ?? '');

  const [absences,   setAbsences]   = useState<Absence[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [empNames,   setEmpNames]   = useState<Record<number, string>>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<AbsenceStatus | 'todos'>('todos');
  const [approving,  setApproving]  = useState<number | null>(null);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [empSearch,  setEmpSearch]  = useState('');

  const load = useCallback(async () => {
    try {
      const [abs, emps] = await Promise.all([getAbsences(), getEmployees()]);
      setAbsences(abs);
      setEmployees(emps);
      const names: Record<number, string> = {};
      emps.forEach(e => { names[e.id] = e.name; });
      setEmpNames(names);
    } catch (e) {
      console.error('[Ferias]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = useMemo(() =>
    activeTab === 'todos' ? absences : absences.filter(a => a.status === activeTab),
    [absences, activeTab],
  );

  const pendingCount = absences.filter(a => a.status === 'pendente').length;

  const filteredEmps = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(q));
  }, [employees, empSearch]);

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleApprove(id: number, approved: boolean) {
    const label = approved ? 'aprovar' : 'recusar';
    Alert.alert(
      approved ? 'Aprovar solicitação' : 'Recusar solicitação',
      `Deseja ${label} esta solicitação?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approved ? 'Aprovar' : 'Recusar',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setApproving(id);
            try {
              const updated = await approveAbsence(id, approved);
              setAbsences(prev => prev.map(a => a.id === id ? updated : a));
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Não foi possível processar.');
            } finally {
              setApproving(null);
            }
          },
        },
      ],
    );
  }

  async function handleSave() {
    if (!form.employee_id) return Alert.alert('Campo obrigatório', 'Selecione o colaborador.');
    if (!form.start_date)  return Alert.alert('Campo obrigatório', 'Informe a data de início.');
    if (!form.end_date)    return Alert.alert('Campo obrigatório', 'Informe a data de fim.');

    setSaving(true);
    try {
      const data: CreateAbsenceData = {
        employee_id: form.employee_id,
        type:        form.type,
        start_date:  form.start_date,
        end_date:    form.end_date,
        status:      form.status,
        reason:      form.reason.trim() || undefined,
      };
      const created = await createAbsence(data);
      setAbsences(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEmpSearch('');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
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
      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={14} color={theme.warning} />
          <Text style={styles.pendingText}>
            {pendingCount} solicitaç{pendingCount > 1 ? 'ões' : 'ão'} aguardando aprovação
          </Text>
        </View>
      )}

      <View style={styles.tabsRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.key === 'pendente' && pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="umbrella-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhuma solicitação encontrada</Text>
          </View>
        ) : (
          filtered.map((absence, i) => (
            <Animated.View key={absence.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.empName}>
                      {empNames[absence.employee_id] || `Colaborador #${absence.employee_id}`}
                    </Text>
                    <Text style={styles.absenceType}>{ABSENCE_TYPE_LABELS[absence.type]}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[absence.status]}20` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[absence.status] }]}>
                      {STATUS_LABELS[absence.status]}
                    </Text>
                  </View>
                </View>

                <View style={styles.datesRow}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>INÍCIO</Text>
                    <Text style={styles.dateValue}>{formatDateShort(absence.start_date)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={12} color={theme.textMuted} />
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>FIM</Text>
                    <Text style={styles.dateValue}>{formatDateShort(absence.end_date)}</Text>
                  </View>
                  <View style={styles.daysChip}>
                    <Text style={styles.daysText}>{absence.days_count}d</Text>
                  </View>
                </View>

                {absence.reason ? <Text style={styles.reason} numberOfLines={2}>{absence.reason}</Text> : null}

                {canApprove && absence.status === 'pendente' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.btnRecusar}
                      onPress={() => handleApprove(absence.id, false)}
                      disabled={approving === absence.id}
                    >
                      {approving === absence.id
                        ? <ActivityIndicator size="small" color={theme.danger} />
                        : <Text style={styles.btnRecusarText}>Recusar</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnAprovar}
                      onPress={() => handleApprove(absence.id, true)}
                      disabled={approving === absence.id}
                    >
                      {approving === absence.id
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={styles.btnAprovarText}>Aprovar</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#000" />
      </TouchableOpacity>

      {/* Modal de cadastro */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova Solicitação</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Colaborador *</Text>
            <TextInput
              style={styles.input}
              placeholder="Buscar colaborador..."
              placeholderTextColor={theme.textMuted}
              value={empSearch}
              onChangeText={setEmpSearch}
            />
            {empSearch.length > 0 && (
              <View style={styles.empDropdown}>
                {filteredEmps.slice(0, 6).map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.empOption, form.employee_id === e.id && styles.empOptionActive]}
                    onPress={() => { set('employee_id', e.id); setEmpSearch(e.name); }}
                  >
                    <Text style={[styles.empOptionText, form.employee_id === e.id && styles.empOptionTextActive]}>
                      {e.name}
                    </Text>
                    <Text style={styles.empOptionRole}>{e.role_title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {form.employee_id > 0 && (
              <View style={styles.selectedEmp}>
                <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                <Text style={styles.selectedEmpText}>{empNames[form.employee_id]}</Text>
              </View>
            )}

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chipGroup}>
              {TYPE_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.type === o.key && styles.chipActive]}
                  onPress={() => set('type', o.key)}
                >
                  <Text style={[styles.chipText, form.type === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Data Início * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-07-01" placeholderTextColor={theme.textMuted} value={form.start_date} onChangeText={v => set('start_date', v)} />

            <Text style={styles.label}>Data Fim * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-07-30" placeholderTextColor={theme.textMuted} value={form.end_date} onChangeText={v => set('end_date', v)} />

            <Text style={styles.label}>Motivo</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Motivo da solicitação..."
              placeholderTextColor={theme.textMuted}
              value={form.reason}
              onChangeText={v => set('reason', v)}
              multiline
              numberOfLines={3}
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

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pendingText: { fontSize: 12, color: theme.warning, fontWeight: '600' },

  tabsRow: { flexDirection: 'row', backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: theme.gold },
  tabText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  tabTextActive: { color: theme.gold, fontWeight: '600' },
  badge:         { backgroundColor: theme.warning, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText:     { fontSize: 9, fontWeight: '700', color: '#000' },

  list:      { flex: 1, padding: 12 },
  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  card: {
    backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 10,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTopLeft: { flex: 1, marginRight: 10 },
  empName:     { fontSize: 14, fontWeight: '600', color: theme.text },
  absenceType: { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },

  datesRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dateBlock: { alignItems: 'center' },
  dateLabel: { fontSize: 9, color: theme.textMuted, letterSpacing: 1, marginBottom: 2 },
  dateValue: { fontSize: 13, fontWeight: '600', color: theme.text },
  daysChip:  { marginLeft: 'auto', backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  daysText:  { fontSize: 12, fontWeight: '700', color: theme.gold },

  reason: { fontSize: 12, color: theme.textMuted, marginBottom: 10 },

  actions:        { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnRecusar:     { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: `${theme.danger}40`, alignItems: 'center' },
  btnRecusarText: { fontSize: 12, fontWeight: '600', color: theme.danger },
  btnAprovar:     { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: theme.gold, alignItems: 'center' },
  btnAprovarText: { fontSize: 12, fontWeight: '700', color: '#000' },

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
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  empDropdown: {
    backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  empOption: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  empOptionActive:    { backgroundColor: theme.goldDim },
  empOptionText:      { fontSize: 14, color: theme.text, fontWeight: '500' },
  empOptionTextActive: { color: theme.gold },
  empOptionRole:      { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  selectedEmp:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  selectedEmpText: { fontSize: 13, color: theme.success },

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
