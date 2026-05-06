import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contextos/Autenticacao';
import { Ionicons } from '@expo/vector-icons';
import { getEmployees, createEmployee } from '../../conexoes/colaboradores';
import { Employee, EmployeeStatus, LegalArea, STATUS_LABELS, CreateEmployeeData } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ativo:     theme.success,
  ferias:    theme.info,
  licenca:   theme.warning,
  afastado:  theme.warning,
  desligado: theme.textMuted,
};

const FILTERS: { key: EmployeeStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ativo',    label: 'Ativos' },
  { key: 'ferias',   label: 'Férias' },
  { key: 'licenca',  label: 'Licença' },
  { key: 'afastado', label: 'Afastado' },
];

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
  name: '',
  role_title: '',
  hire_date: new Date().toISOString().slice(0, 10),
  status: 'ativo' as EmployeeStatus,
  phone: '',
  cpf: '',
  birth_date: '',
  legal_area: undefined as LegalArea | undefined,
  oab_number: '',
  vacation_days: 30,
};

export default function ColaboradoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canManageEmployees = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<EmployeeStatus | 'todos'>('todos');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const matchStatus = filter === 'todos' || e.status === filter;
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role_title.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [employees, filter, search]);

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim())       return Alert.alert('Campo obrigatório', 'Informe o nome.');
    if (!form.role_title.trim()) return Alert.alert('Campo obrigatório', 'Informe o cargo.');
    if (!form.hire_date)         return Alert.alert('Campo obrigatório', 'Informe a data de admissão.');

    setSaving(true);
    try {
      const data: CreateEmployeeData = {
        name:         form.name.trim(),
        role_title:   form.role_title.trim(),
        hire_date:    form.hire_date,
        status:       form.status,
        phone:        form.phone.trim() || undefined,
        cpf:          form.cpf.trim() || undefined,
        birth_date:   form.birth_date || undefined,
        legal_area:   form.legal_area,
        oab_number:   form.oab_number.trim() || undefined,
        vacation_days: form.vacation_days,
      };
      const created = await createEmployee(data);
      setEmployees(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
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
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar colaborador..."
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

      <Text style={styles.countLabel}>{filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}</Text>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum colaborador encontrado</Text>
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
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[emp.status]}20` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[emp.status] }]}>
                    {STATUS_LABELS[emp.status]}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB — só para quem pode gerenciar colaboradores */}
      {canManageEmployees && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      )}

      {/* Modal de cadastro */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Colaborador</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nome *</Text>
            <TextInput style={styles.input} placeholder="Nome completo" placeholderTextColor={theme.textMuted} value={form.name} onChangeText={v => set('name', v)} />

            <Text style={styles.label}>Cargo *</Text>
            <TextInput style={styles.input} placeholder="Ex: Advogado Pleno, Estagiário" placeholderTextColor={theme.textMuted} value={form.role_title} onChangeText={v => set('role_title', v)} />

            <Text style={styles.label}>Data de Admissão * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-01-15" placeholderTextColor={theme.textMuted} value={form.hire_date} onChangeText={v => set('hire_date', v)} />

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

            <Text style={styles.label}>Área Jurídica</Text>
            <View style={styles.chipGroup}>
              {LEGAL_AREAS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.legal_area === o.key && styles.chipActive]}
                  onPress={() => set('legal_area', form.legal_area === o.key ? undefined : o.key)}
                >
                  <Text style={[styles.chipText, form.legal_area === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número OAB</Text>
            <TextInput style={styles.input} placeholder="Ex: SP 123456" placeholderTextColor={theme.textMuted} value={form.oab_number} onChangeText={v => set('oab_number', v)} />

            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} placeholder="(11) 99999-9999" placeholderTextColor={theme.textMuted} value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" />

            <Text style={styles.label}>CPF</Text>
            <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor={theme.textMuted} value={form.cpf} onChangeText={v => set('cpf', v)} />

            <Text style={styles.label}>Data de Nascimento (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="1990-05-20" placeholderTextColor={theme.textMuted} value={form.birth_date} onChangeText={v => set('birth_date', v)} />

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

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderBottomWidth: 1,
    borderBottomColor: theme.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon:  { marginRight: 8 },
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

  countLabel: { fontSize: 11, color: theme.textMuted, paddingHorizontal: 16, paddingVertical: 8 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  initials:  { fontSize: 13, fontWeight: '700', color: theme.goldLight },
  empInfo:   { flex: 1 },
  empName:   { fontSize: 14, fontWeight: '600', color: theme.text },
  empRole:   { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  empOab:    { fontSize: 10, color: theme.gold, marginTop: 2, fontFamily: 'monospace' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },

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
  chipActive:    { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  chipText:      { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  chipTextActive: { color: theme.gold },

  modalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  btnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: theme.border, alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  btnSave: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: theme.gold, alignItems: 'center',
  },
  btnSaveText: { fontSize: 14, fontWeight: '700', color: '#000' },
});
