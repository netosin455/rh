import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEmployeeById, updateEmployee, deleteEmployee } from '../../conexoes/colaboradores';
import { apiFetch } from '../../conexoes/http';
import { Employee, EmployeeStatus, LegalArea, STATUS_LABELS, Absence, ABSENCE_TYPE_LABELS } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

const STATUS_OPTIONS: { key: EmployeeStatus; label: string }[] = [
  { key: 'ativo',     label: 'Ativo' },
  { key: 'ferias',    label: 'Férias' },
  { key: 'licenca',   label: 'Licença' },
  { key: 'afastado',  label: 'Afastado' },
  { key: 'desligado', label: 'Desligado' },
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

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ativo:     theme.success,
  ferias:    theme.info,
  licenca:   theme.warning,
  afastado:  theme.warning,
  desligado: theme.textMuted,
};

const ABSENCE_STATUS_COLORS: Record<string, string> = {
  pendente:  theme.warning,
  aprovado:  theme.success,
  recusado:  theme.danger,
  cancelado: theme.textMuted,
};

function getTenure(hireDate: string): string {
  const start = new Date(hireDate + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0 && months > 0) return `${years} ano${years > 1 ? 's' : ''} e ${months} mês${months > 1 ? 'es' : ''}`;
  if (years > 0) return `${years} ano${years > 1 ? 's' : ''}`;
  return `${months} mês${months !== 1 ? 'es' : ''}`;
}

function getAge(birthDate: string): number {
  const birth = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getDaysUntilBirthday(birthDate: string): number {
  const now = new Date();
  const birth = new Date(birthDate + 'T00:00:00');
  const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function formatBirthDate(birthDate: string): string {
  const [y, m, d] = birthDate.split('-');
  return `${d}/${m}/${y}`;
}

export default function ColaboradorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const canEdit   = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');
  const canDelete = ['super_admin','admin'].includes(user?.role ?? '');

  const [employee,  setEmployee]  = useState<Employee | null>(null);
  const [absences,  setAbsences]  = useState<Absence[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [absLoading, setAbsLoading] = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState<Partial<Employee>>({});

  const load = useCallback(async () => {
    try {
      const emp = await getEmployeeById(Number(id));
      setEmployee(emp);
      setForm({
        name:          emp.name,
        role_title:    emp.role_title,
        hire_date:     emp.hire_date,
        status:        emp.status,
        phone:         emp.phone ?? '',
        cpf:           emp.cpf ?? '',
        birth_date:    emp.birth_date ?? '',
        legal_area:    emp.legal_area,
        oab_number:    emp.oab_number ?? '',
        vacation_days: emp.vacation_days,
      });
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Colaborador não encontrado.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAbsences = useCallback(async () => {
    try {
      const data = await apiFetch<Absence[]>(`/api/absences?employee_id=${id}`);
      setAbsences(data);
    } catch {
      setAbsences([]);
    } finally {
      setAbsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); loadAbsences(); }, [load, loadAbsences]);

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name?.trim())       return Alert.alert('Campo obrigatório', 'Informe o nome.');
    if (!form.role_title?.trim()) return Alert.alert('Campo obrigatório', 'Informe o cargo.');

    setSaving(true);
    try {
      const updated = await updateEmployee(Number(id), {
        name:          form.name?.trim(),
        role_title:    form.role_title?.trim(),
        hire_date:     form.hire_date,
        status:        form.status,
        phone:         form.phone?.trim() || undefined,
        cpf:           form.cpf?.trim() || undefined,
        birth_date:    form.birth_date || undefined,
        legal_area:    form.legal_area,
        oab_number:    form.oab_number?.trim() || undefined,
        vacation_days: form.vacation_days,
      });
      setEmployee(updated);
      setEditing(false);
      Alert.alert('Sucesso', 'Colaborador atualizado com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Excluir colaborador',
      `Deseja excluir ${employee?.name}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployee(Number(id));
              router.back();
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

  if (!employee) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{employee.name}</Text>
        {canEdit && (
          <TouchableOpacity onPress={() => setEditing(e => !e)} style={styles.editBtn}>
            <Ionicons name={editing ? 'close' : 'pencil'} size={18} color={theme.gold} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Avatar e status */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarInitials}>
              {employee.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{employee.name}</Text>
            <Text style={styles.profileRole}>{employee.role_title}</Text>
            {employee.oab_number && (
              <Text style={styles.profileOab}>OAB {employee.oab_number}</Text>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[employee.status]}20` }]}>
              <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[employee.status] }]}>
                {STATUS_LABELS[employee.status]}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Banner de aniversário */}
        {!editing && employee.birth_date && (() => {
          const days = getDaysUntilBirthday(employee.birth_date!);
          if (days > 7) return null;
          const isToday = days === 0;
          return (
            <View style={[styles.birthdayBanner, isToday && styles.birthdayBannerToday]}>
              <Text style={styles.birthdayBannerIcon}>{isToday ? '🎂' : '🎁'}</Text>
              <View>
                <Text style={[styles.birthdayBannerTitle, isToday && { color: theme.gold }]}>
                  {isToday
                    ? `Aniversário hoje! ${getAge(employee.birth_date!)} anos`
                    : `Aniversário em ${days} dia${days > 1 ? 's' : ''}`}
                </Text>
                {isToday && (
                  <Text style={styles.birthdayBannerSub}>Não esqueça de parabenizar 🎉</Text>
                )}
              </View>
            </View>
          );
        })()}

        {/* Campos */}
        {editing ? (
          <View style={styles.formSection}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => set('name', v)} placeholderTextColor={theme.textMuted} />

            <Text style={styles.label}>Cargo *</Text>
            <TextInput style={styles.input} value={form.role_title} onChangeText={v => set('role_title', v)} placeholderTextColor={theme.textMuted} />

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
            <TextInput style={styles.input} value={form.oab_number} onChangeText={v => set('oab_number', v)} placeholder="SP 123456" placeholderTextColor={theme.textMuted} />

            <Text style={styles.label}>Telefone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={v => set('phone', v)} placeholder="(11) 99999-9999" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />

            <Text style={styles.label}>CPF</Text>
            <TextInput style={styles.input} value={form.cpf} onChangeText={v => set('cpf', v)} placeholder="000.000.000-00" placeholderTextColor={theme.textMuted} />

            <Text style={styles.label}>Data de Admissão (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={form.hire_date} onChangeText={v => set('hire_date', v)} placeholderTextColor={theme.textMuted} />

            <Text style={styles.label}>Data de Nascimento (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={form.birth_date} onChangeText={v => set('birth_date', v)} placeholder="1990-05-20" placeholderTextColor={theme.textMuted} />

            <View style={{ height: 20 }} />
          </View>
        ) : (
          <View style={styles.infoSection}>
            <InfoRow icon="calendar-outline"  label="Admissão"    value={employee.hire_date} />
            {employee.hire_date && (
              <InfoRow icon="time-outline" label="Tempo de casa" value={getTenure(employee.hire_date)} />
            )}
            {employee.phone ? (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => Linking.openURL(`tel:${employee.phone}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={16} color={theme.gold} style={styles.infoIcon} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefone</Text>
                  <Text style={[styles.infoValue, { color: theme.gold }]}>{employee.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.gold} />
              </TouchableOpacity>
            ) : null}
            <InfoRow icon="card-outline"      label="CPF"         value={employee.cpf} />
            {employee.birth_date && (
              <InfoRow
                icon="gift-outline"
                label="Nascimento"
                value={`${formatBirthDate(employee.birth_date)} · ${getAge(employee.birth_date)} anos`}
              />
            )}
            <InfoRow icon="briefcase-outline" label="Área"        value={employee.legal_area} />
            <InfoRow icon="umbrella-outline"  label="Dias férias" value={String(employee.vacation_days)} />
          </View>
        )}

        {/* Histórico de ausências */}
        {!editing && (
          <View style={styles.absenceSection}>
            <View style={styles.absenceHeader}>
              <Ionicons name="calendar-outline" size={16} color={theme.gold} />
              <Text style={styles.absenceTitle}>Histórico de ausências</Text>
            </View>
            {absLoading ? (
              <ActivityIndicator color={theme.gold} size="small" style={{ margin: 16 }} />
            ) : absences.length === 0 ? (
              <Text style={styles.absenceEmpty}>Nenhuma ausência registrada</Text>
            ) : (
              absences.map(a => (
                <View key={a.id} style={styles.absenceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.absenceType}>{ABSENCE_TYPE_LABELS[a.type]}</Text>
                    <Text style={styles.absenceDates}>
                      {a.start_date} → {a.end_date} · {a.days_count} dia{a.days_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.absenceBadge, { backgroundColor: `${ABSENCE_STATUS_COLORS[a.status]}20` }]}>
                    <Text style={[styles.absenceBadgeText, { color: ABSENCE_STATUS_COLORS[a.status] }]}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Ações */}
        {editing && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setEditing(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.btnSaveText}>Salvar alterações</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {canDelete && !editing && (
          <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={theme.danger} />
            <Text style={styles.btnDeleteText}>Excluir colaborador</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={theme.textMuted} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn:     { padding: 4, marginRight: 10 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.white },
  editBtn:     { padding: 4, marginLeft: 10 },

  body: { flex: 1 },

  profileSection: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 20, backgroundColor: theme.surface,
  },
  avatarLarge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.goldDim, borderWidth: 2, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 22, fontWeight: '700', color: theme.goldLight },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 18, fontWeight: '700', color: theme.white, marginBottom: 2 },
  profileRole:    { fontSize: 13, color: theme.textLight, marginBottom: 4 },
  profileOab:     { fontSize: 11, color: theme.gold, fontFamily: 'monospace', marginBottom: 6 },
  statusBadge:    { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: theme.border },

  birthdayBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, padding: 14,
  },
  birthdayBannerToday: {
    backgroundColor: theme.goldDim,
    borderColor: theme.border2,
  },
  birthdayBannerIcon:  { fontSize: 28 },
  birthdayBannerTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  birthdayBannerSub:   { fontSize: 12, color: theme.textMuted, marginTop: 2 },

  infoSection: { padding: 20, gap: 4 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  infoIcon:    { marginRight: 14 },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 10, color: theme.textMuted, letterSpacing: 0.8, marginBottom: 2, textTransform: 'uppercase' },
  infoValue:   { fontSize: 14, color: theme.text },

  absenceSection: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: theme.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
  },
  absenceHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  absenceTitle: { fontSize: 13, fontWeight: '600', color: theme.white },
  absenceEmpty: { fontSize: 13, color: theme.textMuted, padding: 14 },
  absenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  absenceType:      { fontSize: 13, color: theme.text, fontWeight: '500', marginBottom: 2 },
  absenceDates:     { fontSize: 11, color: theme.textMuted },
  absenceBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  absenceBadgeText: { fontSize: 10, fontWeight: '600' },

  formSection: { padding: 20 },
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

  actions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  btnCancel:     { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  btnCancelText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  btnSave:       { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.gold, alignItems: 'center' },
  btnSaveText:   { fontSize: 14, fontWeight: '700', color: '#000' },

  btnDelete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16, paddingVertical: 12,
    borderRadius: 8, borderWidth: 1, borderColor: `${theme.danger}40`,
  },
  btnDeleteText: { fontSize: 14, color: theme.danger, fontWeight: '600' },
});
