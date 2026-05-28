import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAbsences, createAbsence } from '../../conexoes/ausencias';
import { getEmployees } from '../../conexoes/colaboradores';
import { Absence, AbsenceType, ABSENCE_TYPE_LABELS, CreateAbsenceData, Employee } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { formatDateShort } from '../../helpers/datas';
import { exportAbsencesPDF } from '../../helpers/pdf';
import { useToast } from '../../contextos/Toast';

const TYPE_COLORS: Record<AbsenceType, string> = {
  ferias:               theme.gold,
  licenca_medica:       theme.info,
  licenca_maternidade:  '#A78BFA',
  licenca_paternidade:  '#34D399',
  folga:                theme.success,
  falta:                theme.danger,
  outro:                theme.textMuted,
};

const FILTER_TABS: { key: AbsenceType | 'todos'; label: string }[] = [
  { key: 'todos',              label: 'Todos' },
  { key: 'falta',              label: 'Faltas' },
  { key: 'ferias',             label: 'Férias' },
  { key: 'licenca_medica',     label: 'Médica' },
  { key: 'folga',              label: 'Folga' },
  { key: 'outro',              label: 'Outro' },
];

const TYPE_OPTIONS: { key: AbsenceType; label: string }[] = [
  { key: 'falta',               label: 'Falta' },
  { key: 'ferias',              label: 'Férias' },
  { key: 'licenca_medica',      label: 'Licença Médica' },
  { key: 'licenca_maternidade', label: 'Lic. Maternidade' },
  { key: 'licenca_paternidade', label: 'Lic. Paternidade' },
  { key: 'folga',               label: 'Folga' },
  { key: 'outro',               label: 'Outro' },
];

const EMPTY_FORM = {
  employee_id: 0,
  type:       'falta' as AbsenceType,
  start_date: '',
  end_date:   '',
  reason:     '',
};

export default function FeriasScreen() {
  const toast = useToast();
  const [absences,   setAbsences]   = useState<Absence[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [empNames,   setEmpNames]   = useState<Record<number, string>>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<AbsenceType | 'todos'>('todos');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [empSearch,  setEmpSearch]  = useState('');
  const [formError,  setFormError]  = useState('');

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
    activeTab === 'todos' ? absences : absences.filter(a => a.type === activeTab),
    [absences, activeTab],
  );

  const filteredEmps = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(q));
  }, [employees, empSearch]);

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setEmpSearch('');
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.employee_id) { setFormError('Selecione o colaborador.'); return; }
    if (!form.start_date)  { setFormError('Informe a data de início.'); return; }
    if (!form.end_date)    { setFormError('Informe a data de fim.'); return; }

    setSaving(true);
    try {
      const data: CreateAbsenceData = {
        employee_id: form.employee_id,
        type:        form.type,
        start_date:  form.start_date,
        end_date:    form.end_date,
        reason:      form.reason.trim() || undefined,
      };
      const created = await createAbsence(data);
      setAbsences(prev => [created, ...prev]);
      setShowModal(false);
      toast.success('Lançamento registrado com sucesso!');
      setForm(EMPTY_FORM);
      setEmpSearch('');
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
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

      {/* Abas de filtro por tipo */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contagem + export */}
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</Text>
        {Platform.OS === 'web' && filtered.length > 0 && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportAbsencesPDF(filtered as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="download-outline" size={13} color={theme.gold} />
            <Text style={styles.exportBtnText}>PDF</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="umbrella-outline" size={44} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum registro</Text>
            <Text style={styles.emptyText}>Não há lançamentos para este filtro</Text>
          </View>
        ) : (
          filtered.map((absence, i) => {
            const color = TYPE_COLORS[absence.type];
            return (
              <Animated.View key={absence.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <View style={styles.card}>
                  <View style={[styles.cardAccent, { backgroundColor: color }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empName}>
                          {empNames[absence.employee_id] || `Colaborador #${absence.employee_id}`}
                        </Text>
                        <View style={[styles.typePill, { backgroundColor: `${color}18` }]}>
                          <Text style={[styles.typeText, { color }]}>
                            {ABSENCE_TYPE_LABELS[absence.type]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.daysChip}>
                        <Text style={styles.daysText}>{absence.days_count}d</Text>
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
                    </View>

                    {absence.reason ? (
                      <Text style={styles.reason} numberOfLines={2}>{absence.reason}</Text>
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#000" />
      </TouchableOpacity>

      {/* Modal de cadastro */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Novo Lançamento</Text>
              <Text style={styles.modalSubtitle}>Férias, licença ou afastamento</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Colaborador *</Text>
            <TextInput
              style={styles.input}
              placeholder="Buscar colaborador..."
              placeholderTextColor={theme.textMuted}
              value={empSearch}
              onChangeText={v => { setEmpSearch(v); setF('employee_id', 0); }}
            />
            {empSearch.length > 0 && form.employee_id === 0 && (
              <View style={styles.empDropdown}>
                {filteredEmps.slice(0, 6).map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.empOption}
                    onPress={() => { setF('employee_id', e.id); setEmpSearch(e.name); }}
                  >
                    <Text style={styles.empOptionText}>{e.name}</Text>
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
                  onPress={() => setF('type', o.key)}
                >
                  <Text style={[styles.chipText, form.type === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Data Início * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-07-01" placeholderTextColor={theme.textMuted} value={form.start_date} onChangeText={v => setF('start_date', v)} />

            <Text style={styles.label}>Data Fim * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-07-30" placeholderTextColor={theme.textMuted} value={form.end_date} onChangeText={v => setF('end_date', v)} />

            <Text style={styles.label}>Observação</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Observação (opcional)..."
              placeholderTextColor={theme.textMuted}
              value={form.reason}
              onChangeText={v => setF('reason', v)}
              multiline numberOfLines={3}
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

  tabsScroll:   { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface },
  tabsContent:  { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  tabActive:     { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  tabText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  tabTextActive: { color: theme.gold, fontWeight: '700' },

  countRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  countLabel: { fontSize: 11, color: theme.gold, fontWeight: '600' },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  exportBtnText: { fontSize: 10, color: theme.gold, fontWeight: '700' },

  list:  { flex: 1, padding: 12 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: theme.textLight },
  emptyText:  { fontSize: 13, color: theme.textMuted },

  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    marginBottom: 10, overflow: 'hidden',
    elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 14 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  empName:    { fontSize: 14, fontWeight: '700', color: theme.white, marginBottom: 4 },

  typePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeText: { fontSize: 10, fontWeight: '700' },

  datesRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateBlock: { alignItems: 'center' },
  dateLabel: { fontSize: 9, color: theme.textMuted, letterSpacing: 1, marginBottom: 2 },
  dateValue: { fontSize: 13, fontWeight: '700', color: theme.white },

  daysChip:  { backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  daysText:  { fontSize: 13, fontWeight: '700', color: theme.gold },

  reason: { fontSize: 12, color: theme.textMuted, marginTop: 8 },

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
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  empDropdown: {
    backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, marginTop: 4, overflow: 'hidden',
  },
  empOption: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  empOptionText: { fontSize: 14, color: theme.text, fontWeight: '500' },
  empOptionRole: { fontSize: 11, color: theme.textMuted, marginTop: 1 },

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
