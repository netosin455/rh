import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contextos/Autenticacao';
import { Ionicons } from '@expo/vector-icons';
import { getEmployees, createEmployee } from '../../conexoes/colaboradores';
import { createAbsence } from '../../conexoes/ausencias';
import { Employee, EmployeeStatus, LegalArea, STATUS_LABELS, CreateEmployeeData } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { brToIso, maskDate, todayBr, getTodayString } from '../../helpers/datas';
import { exportEmployeesPDF } from '../../helpers/pdf';
import { useToast } from '../../contextos/Toast';

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ativo:                theme.success,
  ferias:               theme.info,
  licenca:              theme.warning,
  licenca_medica:       theme.warning,
  licenca_maternidade:  theme.warning,
  licenca_paternidade:  theme.warning,
  afastado:             theme.warning,
  desligado:            theme.textMuted,
};

const FILTERS: { key: EmployeeStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ativo',    label: 'Ativos' },
  { key: 'ferias',   label: 'Férias' },
  { key: 'licenca',  label: 'Licença' },
  { key: 'afastado', label: 'Afastado' },
];

// Filtro "Licença" cobre qualquer variante (médica/maternidade/paternidade)
function matchesStatusFilter(empStatus: EmployeeStatus, filterKey: EmployeeStatus | 'todos'): boolean {
  if (filterKey === 'todos') return true;
  if (filterKey === 'licenca') return empStatus.startsWith('licenca');
  return empStatus === filterKey;
}

const LEGAL_AREAS: { key: LegalArea; label: string }[] = [
  { key: 'civel',       label: 'Cível' },
  { key: 'trabalhista', label: 'Trabalhista' },
  { key: 'tributario',  label: 'Tributário' },
  { key: 'familia',     label: 'Família' },
  { key: 'criminal',    label: 'Criminal' },
  { key: 'empresarial', label: 'Empresarial' },
  { key: 'outro',       label: 'Outro' },
];

const STATUS_OPTIONS: { key: EmployeeStatus; label: string }[] = [
  { key: 'ativo',     label: 'Ativo' },
  { key: 'ferias',    label: 'Férias' },
  { key: 'licenca',   label: 'Licença' },
  { key: 'afastado',  label: 'Afastado' },
  { key: 'desligado', label: 'Desligado' },
];

const EMPTY_FORM = {
  name:         '',
  role_title:   '',
  hire_date:    todayBr(),
  status:       'ativo' as EmployeeStatus,
  phone:        '',
  cpf:          '',
  birth_date:   '',
  legal_area:   undefined as LegalArea | undefined,
  oab_number:   '',
  vacation_days: 30,
  folga_hours:  0,
};

export default function ColaboradoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const canManageEmployees = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<EmployeeStatus | 'todos'>('todos');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState('');
  const [quickModal, setQuickModal] = useState<{ emp: Employee; type: 'falta' | 'folga' } | null>(null);
  const [quickHoursInput, setQuickHoursInput] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setEmployees(await getEmployees());
    } catch (e) {
      console.error('[Colaboradores]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Ação rápida: registrar falta ou folga de hoje, com horas opcionais (útil pra
  // quem não trabalha 8h/dia, ex: estagiário de 6h). Sem horas = dia inteiro.
  function openQuickModal(emp: Employee, type: 'falta' | 'folga') {
    setQuickModal({ emp, type });
    setQuickHoursInput('');
  }

  async function handleConfirmQuick() {
    if (!quickModal) return;
    const { emp, type } = quickModal;
    const raw = quickHoursInput.trim();
    let hours: number | undefined;
    if (raw !== '') {
      hours = parseFloat(raw.replace(',', '.'));
      if (!Number.isFinite(hours) || hours <= 0) {
        toast.warning('Informe um número de horas válido, ou deixe em branco pro dia inteiro.');
        return;
      }
    } else if (type === 'folga') {
      toast.warning('Informe as horas de folga.');
      return;
    }

    setQuickSaving(true);
    try {
      const today = getTodayString();
      await createAbsence({ employee_id: emp.id, type, start_date: today, end_date: today, hours });
      const label = type === 'falta' ? 'Falta' : 'Folga';
      toast.success(`${label}${hours != null ? ` de ${hours}h` : ''} registrada pra ${emp.name}.`);
      setQuickModal(null);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível registrar.');
    } finally {
      setQuickSaving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const matchStatus = matchesStatusFilter(e.status, filter);
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role_title.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [employees, filter, search]);

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
    if (!form.name.trim())       { setFormError('Informe o nome completo.'); return; }
    if (!form.role_title.trim()) { setFormError('Informe o cargo.'); return; }
    if (!form.hire_date)         { setFormError('Informe a data de admissão.'); return; }

    const hireDateIso  = brToIso(form.hire_date);
    const birthDateIso = form.birth_date ? brToIso(form.birth_date) : '';
    if (!hireDateIso)                          { setFormError('Data de admissão inválida. Use DD/MM/AAAA.'); return; }
    if (form.birth_date && !birthDateIso)      { setFormError('Data de nascimento inválida. Use DD/MM/AAAA.'); return; }

    setSaving(true);
    try {
      const data: CreateEmployeeData = {
        name:          form.name.trim(),
        role_title:    form.role_title.trim(),
        hire_date:     hireDateIso,
        status:        form.status,
        phone:         form.phone.trim() || undefined,
        cpf:           form.cpf.trim() || undefined,
        birth_date:    birthDateIso || undefined,
        legal_area:    form.legal_area,
        oab_number:    form.oab_number.trim() || undefined,
        vacation_days: form.vacation_days,
        folga_hours:   form.folga_hours,
      };
      const created = await createEmployee(data);
      setEmployees(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
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
      {/* Barra de busca */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou cargo..."
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

      {/* Filtros */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterRow} contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contagem + export */}
      <View style={styles.countRow}>
        <Text style={styles.countLabel}>
          {filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}
        </Text>
        {Platform.OS === 'web' && filtered.length > 0 && (
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportEmployeesPDF(filtered)}
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
            <Ionicons name="people-outline" size={44} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum colaborador</Text>
            <Text style={styles.emptyText}>
              {search ? 'Tente outro termo de busca' : 'Nenhum resultado para este filtro'}
            </Text>
          </View>
        ) : (
          filtered.map((emp, i) => (
            <Animated.View key={emp.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <TouchableOpacity
                style={styles.empRow}
                onPress={() => router.push(`/colaborador/${emp.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={styles.avatar}>
                  <Text style={styles.initials}>
                    {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </Text>
                </View>
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{emp.name}</Text>
                  <Text style={styles.empRole}>{emp.role_title}</Text>
                  {emp.oab_number && (
                    <Text style={styles.empOab}>OAB {emp.oab_number}</Text>
                  )}
                </View>
                <View style={styles.empRight}>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[emp.status]}20` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[emp.status] }]}>
                      {STATUS_LABELS[emp.status]}
                    </Text>
                  </View>
                  {canManageEmployees && (
                    <View style={styles.quickActionsRow}>
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => openQuickModal(emp, 'falta')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle-outline" size={15} color={theme.danger} />
                        <Text style={styles.quickActionText}>Falta</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickActionBtn}
                        onPress={() => openQuickModal(emp, 'folga')}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="time-outline" size={15} color={theme.gold} />
                        <Text style={styles.quickActionText}>Folga</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      {canManageEmployees && (
        <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      )}

      {/* Modal de cadastro */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Novo Colaborador</Text>
              <Text style={styles.modalSubtitle}>Preencha os dados do colaborador</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nome *</Text>
            <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={theme.textMuted} value={form.name} onChangeText={v => setF('name', v)} />

            <Text style={styles.label}>Cargo *</Text>
            <TextInput style={styles.input} placeholder="Ex: Advogado Pleno, Estagiário" placeholderTextColor={theme.textMuted} value={form.role_title} onChangeText={v => setF('role_title', v)} />

            <Text style={styles.label}>Data de Admissão * (DD/MM/AAAA)</Text>
            <TextInput style={styles.input} placeholder="07/05/2024" placeholderTextColor={theme.textMuted} value={form.hire_date} onChangeText={v => setF('hire_date', maskDate(v))} keyboardType="numeric" maxLength={10} />

            <Text style={styles.label}>Status</Text>
            <View style={styles.chipGroup}>
              {STATUS_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.status === o.key && styles.chipActive]}
                  onPress={() => setF('status', o.key)}
                >
                  <Text style={[styles.chipText, form.status === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Área Jurídica</Text>
            <View style={styles.chipGroup}>
              {LEGAL_AREAS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.legal_area === o.key && styles.chipActive]}
                  onPress={() => setF('legal_area', form.legal_area === o.key ? undefined : o.key)}
                >
                  <Text style={[styles.chipText, form.legal_area === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número OAB</Text>
            <TextInput style={styles.input} placeholder="Ex: SP 123456" placeholderTextColor={theme.textMuted} value={form.oab_number} onChangeText={v => setF('oab_number', v)} />

            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} placeholder="(11) 99999-9999" placeholderTextColor={theme.textMuted} value={form.phone} onChangeText={v => setF('phone', v)} keyboardType="phone-pad" />

            <Text style={styles.label}>CPF</Text>
            <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor={theme.textMuted} value={form.cpf} onChangeText={v => setF('cpf', v)} />

            <Text style={styles.label}>Data de Nascimento (DD/MM/AAAA)</Text>
            <TextInput style={styles.input} placeholder="07/05/1990" placeholderTextColor={theme.textMuted} value={form.birth_date} onChangeText={v => setF('birth_date', maskDate(v))} keyboardType="numeric" maxLength={10} />

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

      {/* Modal rápido: falta ou folga, horas opcionais */}
      <Modal visible={!!quickModal} animationType="fade" transparent onRequestClose={() => setQuickModal(null)}>
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalBox}>
            <Text style={styles.quickModalTitle}>
              {quickModal?.type === 'falta' ? 'Registrar falta hoje' : 'Registrar folga hoje'}
            </Text>
            <Text style={styles.quickModalSubtitle}>{quickModal?.emp.name}</Text>
            <Text style={styles.label}>Horas {quickModal?.type === 'falta' ? '(opcional — em branco conta o dia inteiro)' : ''}</Text>
            <TextInput
              style={styles.input}
              placeholder={quickModal?.type === 'falta' ? 'Ex: 3 (estagiário de 6h que faltou meio turno)' : 'Ex: 4'}
              placeholderTextColor={theme.textMuted}
              value={quickHoursInput}
              onChangeText={setQuickHoursInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.quickModalFooter}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setQuickModal(null)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleConfirmQuick} disabled={quickSaving}>
                {quickSaving
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.btnSaveText}>Confirmar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.surface, borderBottomWidth: 1,
    borderBottomColor: theme.border, paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.text },

  filterRow:     { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: theme.border },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  filterChipActive: { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  filterText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  filterTextActive: { color: theme.gold },

  countRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
  countLabel: { fontSize: 11, color: theme.gold, fontWeight: '600' },
  exportBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  exportBtnText: { fontSize: 10, color: theme.gold, fontWeight: '700' },
  list: { flex: 1 },

  empty: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: theme.textLight },
  emptyText:  { fontSize: 13, color: theme.textMuted },

  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  initials:  { fontSize: 14, fontWeight: '800', color: theme.gold },
  empInfo:   { flex: 1 },
  empName:   { fontSize: 14, fontWeight: '700', color: theme.white },
  empRole:   { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  empOab:    { fontSize: 10, color: theme.gold, marginTop: 2 },
  empRight:  { alignItems: 'flex-end', gap: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  quickActionsRow: { flexDirection: 'row', gap: 8 },
  quickActionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  quickActionText: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },

  quickModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  quickModalBox: { width: '100%', maxWidth: 360, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 20 },
  quickModalTitle: { fontSize: 16, fontWeight: '700', color: theme.white },
  quickModalSubtitle: { fontSize: 13, color: theme.textMuted, marginTop: 2, marginBottom: 8 },
  quickModalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },

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
