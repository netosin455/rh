import React, { useEffect, useState, useCallback, Component } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Linking, Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEmployeeById, updateEmployee, deleteEmployee } from '../../conexoes/colaboradores';
import { startOnboarding } from '../../conexoes/onboarding';
import { getPayslips, createPayslip, deletePayslip } from '../../conexoes/holerites';
import { apiFetch } from '../../conexoes/http';
import {
  Employee, EmployeeStatus, LegalArea,
  STATUS_LABELS, Absence, ABSENCE_TYPE_LABELS, Payslip,
} from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';
import { ymd, brToIso, isoToBr, maskDate } from '../../helpers/datas';

// ── Constantes ────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function formatDate(s?: string | null): string {
  if (!s) return '—';
  const parts = ymd(s).split('-');
  const [y, m, d] = parts;
  return d && m && y ? `${d}/${m}/${y}` : s;
}

function getTenure(hireDate: string): string {
  const start = new Date(ymd(hireDate) + 'T00:00:00');
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years > 0 && months > 0) return `${years}a ${months}m`;
  if (years > 0) return `${years} ano${years > 1 ? 's' : ''}`;
  return `${months} mês${months !== 1 ? 'es' : ''}`;
}

function getAge(birthDate: string): number {
  const birth = new Date(ymd(birthDate) + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function getDaysUntilBirthday(birthDate: string): number {
  const now = new Date();
  const birth = new Date(ymd(birthDate) + 'T00:00:00');
  const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ── Componentes auxiliares ────────────────────────────────────
function SectionTitle({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={14} color={theme.gold} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, highlight }: {
  icon: any; label: string; value?: string | null; highlight?: boolean
}) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={highlight ? theme.gold : theme.textMuted} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, highlight && { color: theme.gold }]}>{value}</Text>
      </View>
    </View>
  );
}

// ── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F1115', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ color: '#F87171', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Erro ao carregar perfil</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Tela principal ────────────────────────────────────────────
function ColaboradorScreenInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();

  const canEdit   = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');
  const canDelete = ['super_admin','admin'].includes(user?.role ?? '');
  const canSeeSalary = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  const [employee,      setEmployee]      = useState<Employee | null>(null);
  const [absences,      setAbsences]      = useState<Absence[]>([]);
  const [payslips,      setPayslips]      = useState<Payslip[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [absLoading,    setAbsLoading]    = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [editing,       setEditing]       = useState(false);
  const [form,          setForm]          = useState<Partial<Employee & { salary: string }>>({});
  const [payslipModal,  setPayslipModal]  = useState(false);
  const [psForm,        setPsForm]        = useState({ month: '', description: '', file_url: '' });
  const [psSaving,      setPsSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const emp = await getEmployeeById(Number(id));
      setEmployee(emp);
      setForm({
        name:          emp.name,
        role_title:    emp.role_title,
        hire_date:     isoToBr(emp.hire_date),
        status:        emp.status,
        phone:         emp.phone ?? '',
        cpf:           emp.cpf ?? '',
        birth_date:    emp.birth_date ? isoToBr(emp.birth_date) : '',
        legal_area:    emp.legal_area,
        oab_number:    emp.oab_number ?? '',
        vacation_days: emp.vacation_days,
        salary:        emp.salary != null ? String(emp.salary) : '',
      });
    } catch (e: any) {
      setLoadError(e.message || 'Não foi possível carregar o colaborador.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAbsences = useCallback(async () => {
    try {
      const data = await apiFetch<Absence[]>(`/api/absences?employee_id=${id}`);
      setAbsences(Array.isArray(data) ? data : []);
    } catch {
      setAbsences([]);
    } finally {
      setAbsLoading(false);
    }
  }, [id]);

  const loadPayslips = useCallback(async () => {
    try {
      setPayslips(await getPayslips(Number(id)));
    } catch { setPayslips([]); }
  }, [id]);

  useEffect(() => { load(); loadAbsences(); loadPayslips(); }, [load, loadAbsences, loadPayslips]);

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name?.trim())       return Alert.alert('Campo obrigatório', 'Informe o nome.');
    if (!form.role_title?.trim()) return Alert.alert('Campo obrigatório', 'Informe o cargo.');

    const hireDateIso  = brToIso(form.hire_date ?? '');
    const birthDateIso = form.birth_date ? brToIso(form.birth_date) : '';
    if (!hireDateIso)                           return Alert.alert('Data inválida', 'Admissão: use DD/MM/AAAA.');
    if (form.birth_date && !birthDateIso)       return Alert.alert('Data inválida', 'Nascimento: use DD/MM/AAAA.');

    setSaving(true);
    try {
      const salaryNum = form.salary ? parseFloat(String(form.salary).replace(',', '.')) : undefined;
      const updated = await updateEmployee(Number(id), {
        name:          form.name.trim(),
        role_title:    form.role_title.trim(),
        hire_date:     hireDateIso,
        status:        form.status,
        phone:         form.phone?.trim() || undefined,
        cpf:           form.cpf?.trim() || undefined,
        birth_date:    birthDateIso || undefined,
        legal_area:    form.legal_area,
        oab_number:    form.oab_number?.trim() || undefined,
        vacation_days: form.vacation_days,
        salary:        !isNaN(salaryNum!) ? salaryNum : undefined,
      });
      setEmployee(updated);
      setEditing(false);
      Alert.alert('Sucesso', 'Colaborador atualizado.');
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
          text: 'Excluir', style: 'destructive',
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

  // ── Estados de loading / erro ────────────────────────────────
  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator color={theme.gold} size="large" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (loadError || !employee) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="person-outline" size={48} color={theme.textMuted} />
        <Text style={styles.errorTitle}>Colaborador não encontrado</Text>
        <Text style={styles.errorMsg}>{loadError || 'Verifique sua conexão e tente novamente.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={16} color={theme.gold} />
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Dados calculados ──────────────────────────────────────────
  const birthdayDays = employee.birth_date ? getDaysUntilBirthday(employee.birth_date) : null;
  const isToday      = birthdayDays === 0;
  const vacTotal     = 30;
  const vacUsed      = vacTotal - (employee.vacation_days ?? 0);
  const vacPct       = Math.max(0, Math.min(1, vacUsed / vacTotal));

  // ── Render ────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {editing ? 'Editar colaborador' : employee.name}
        </Text>
        {canEdit && (
          <TouchableOpacity onPress={() => setEditing(e => !e)} style={styles.headerBtn}>
            <Ionicons name={editing ? 'close' : 'pencil'} size={18} color={theme.gold} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Perfil ──────────────────────────────────────────── */}
        {!editing && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{getInitials(employee.name)}</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileName}>{employee.name}</Text>
              <Text style={styles.profileRole}>{employee.role_title}</Text>
              {employee.department_name && (
                <Text style={styles.profileDept}>
                  <Ionicons name="business-outline" size={11} color={theme.textMuted} /> {employee.department_name}
                </Text>
              )}
              {employee.oab_number && (
                <Text style={styles.profileOab}>OAB {employee.oab_number}</Text>
              )}
              <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[employee.status]}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[employee.status] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLORS[employee.status] }]}>
                  {STATUS_LABELS[employee.status]}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Stats rápidos ────────────────────────────────────── */}
        {!editing && (
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={16} color={theme.gold} />
              <Text style={styles.statValue}>{getTenure(employee.hire_date)}</Text>
              <Text style={styles.statLabel}>de casa</Text>
            </View>
            {employee.birth_date && (
              <View style={[styles.statCard, isToday && styles.statCardToday]}>
                <Text style={styles.statEmoji}>{isToday ? '🎂' : '🎁'}</Text>
                <Text style={[styles.statValue, isToday && { color: theme.gold }]}>
                  {isToday ? 'Hoje!' : `${birthdayDays}d`}
                </Text>
                <Text style={styles.statLabel}>{isToday ? 'Aniversário' : 'p/ aniversário'}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.statCard, !employee.phone && styles.statCardDisabled]}
              onPress={() => employee.phone && Linking.openURL(`tel:${employee.phone}`)}
              activeOpacity={employee.phone ? 0.7 : 1}
            >
              <Ionicons name="call-outline" size={16} color={employee.phone ? theme.gold : theme.textMuted} />
              <Text style={[styles.statValue, !employee.phone && { color: theme.textMuted }]}>
                {employee.phone ? 'Ligar' : '—'}
              </Text>
              <Text style={styles.statLabel}>telefone</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Modo visualização ────────────────────────────────── */}
        {!editing && (
          <>
            {/* Dados pessoais */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
              <SectionTitle icon="person-outline" title="Dados pessoais" />
              <InfoRow icon="card-outline"      label="CPF"              value={employee.cpf} />
              <InfoRow icon="gift-outline"      label="Data de nascimento"
                value={employee.birth_date
                  ? `${formatDate(employee.birth_date)} · ${getAge(employee.birth_date)} anos`
                  : null}
              />
              {employee.phone ? (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(`tel:${employee.phone}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={15} color={theme.gold} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Telefone</Text>
                    <Text style={[styles.infoValue, { color: theme.gold }]}>{employee.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={13} color={theme.gold} />
                </TouchableOpacity>
              ) : (
                <InfoRow icon="call-outline" label="Telefone" value={null} />
              )}
            </Animated.View>

            {/* Dados profissionais */}
            <Animated.View entering={FadeInDown.delay(140).duration(300)} style={styles.section}>
              <SectionTitle icon="briefcase-outline" title="Dados profissionais" />
              <InfoRow icon="ribbon-outline"    label="Cargo"           value={employee.role_title} />
              <InfoRow icon="business-outline"  label="Departamento"    value={employee.department_name} />
              <InfoRow icon="calendar-outline"  label="Admissão"        value={formatDate(employee.hire_date)} />
              <InfoRow icon="time-outline"      label="Tempo de casa"   value={getTenure(employee.hire_date)} />
              <InfoRow icon="scale-outline"     label="Área jurídica"
                value={employee.legal_area
                  ? LEGAL_AREAS.find(a => a.key === employee.legal_area)?.label
                  : null}
              />
              <InfoRow icon="document-text-outline" label="OAB"         value={employee.oab_number} />
              {canSeeSalary && employee.salary != null && (
                <InfoRow
                  icon="cash-outline"
                  label="Salário base"
                  highlight
                  value={`R$ ${Number(employee.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
              )}
            </Animated.View>

            {/* Férias */}
            <Animated.View entering={FadeInDown.delay(180).duration(300)} style={styles.section}>
              <SectionTitle icon="umbrella-outline" title="Férias" />
              <View style={styles.vacRow}>
                <View style={styles.vacInfo}>
                  <Text style={styles.vacDays}>{employee.vacation_days}</Text>
                  <Text style={styles.vacLabel}>dias disponíveis</Text>
                </View>
                <View style={styles.vacBarWrap}>
                  <View style={styles.vacBarBg}>
                    <View style={[styles.vacBarFill, { width: `${(1 - vacPct) * 100}%` }]} />
                  </View>
                  <Text style={styles.vacSubLabel}>
                    {vacUsed > 0 ? `${vacUsed} usados de ${vacTotal}` : `${vacTotal} dias no total`}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Histórico de ausências */}
            <Animated.View entering={FadeInDown.delay(220).duration(300)} style={styles.section}>
              <SectionTitle icon="calendar-clear-outline" title="Histórico de ausências" />
              {absLoading ? (
                <ActivityIndicator color={theme.gold} size="small" style={{ margin: 16 }} />
              ) : absences.length === 0 ? (
                <View style={styles.emptyAbs}>
                  <Ionicons name="checkmark-circle-outline" size={24} color={theme.textMuted} />
                  <Text style={styles.emptyAbsText}>Nenhuma ausência registrada</Text>
                </View>
              ) : (
                absences.map(a => (
                  <View key={a.id} style={styles.absRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.absType}>{ABSENCE_TYPE_LABELS[a.type]}</Text>
                      <Text style={styles.absDates}>
                        {formatDate(a.start_date)} → {formatDate(a.end_date)}
                        {'  ·  '}{a.days_count} dia{a.days_count !== 1 ? 's' : ''}
                      </Text>
                      {a.reason ? <Text style={styles.absReason}>{a.reason}</Text> : null}
                    </View>
                    <View style={[styles.absBadge, { backgroundColor: `${ABSENCE_STATUS_COLORS[a.status]}20` }]}>
                      <Text style={[styles.absBadgeText, { color: ABSENCE_STATUS_COLORS[a.status] }]}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Animated.View>

            {/* Holerites */}
            <Animated.View entering={FadeInDown.delay(260).duration(300)} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <SectionTitle icon="document-outline" title="Holerites" />
                {canEdit && (
                  <TouchableOpacity
                    style={styles.addPayslipBtn}
                    onPress={() => { setPsForm({ month: '', description: '', file_url: '' }); setPayslipModal(true); }}
                  >
                    <Ionicons name="add" size={14} color={theme.gold} />
                    <Text style={styles.addPayslipText}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {payslips.length === 0 ? (
                <View style={styles.emptyAbs}>
                  <Ionicons name="document-outline" size={22} color={theme.textMuted} />
                  <Text style={styles.emptyAbsText}>Nenhum holerite cadastrado</Text>
                </View>
              ) : (
                payslips.map(p => (
                  <View key={p.id} style={styles.payslipRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payslipMonth}>
                        {(() => {
                          const [y, m] = p.month.split('-');
                          const d = new Date(Number(y), Number(m) - 1, 1);
                          return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        })()}
                      </Text>
                      {p.description ? <Text style={styles.payslipDesc}>{p.description}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.viewPayslipBtn}
                      onPress={() => Linking.openURL(p.file_url)}
                    >
                      <Ionicons name="open-outline" size={14} color={theme.info} />
                      <Text style={styles.viewPayslipText}>Ver</Text>
                    </TouchableOpacity>
                    {canEdit && (
                      <TouchableOpacity
                        style={styles.delPayslipBtn}
                        onPress={() => Alert.alert('Remover', 'Remover este holerite?', [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Remover', style: 'destructive', onPress: async () => {
                              try { await deletePayslip(p.id); loadPayslips(); }
                              catch (e: any) { Alert.alert('Erro', e?.message); }
                          }},
                        ])}
                      >
                        <Ionicons name="trash-outline" size={14} color={theme.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </Animated.View>

            {/* Modal adicionar holerite */}
            <Modal visible={payslipModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPayslipModal(false)}>
              <KeyboardAvoidingView style={styles.psModal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.psModalHeader}>
                  <Text style={styles.psModalTitle}>Adicionar Holerite</Text>
                  <TouchableOpacity onPress={() => setPayslipModal(false)}>
                    <Ionicons name="close" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.psModalBody}>
                  <Text style={styles.psLabel}>MÊS (YYYY-MM) *</Text>
                  <TextInput
                    style={styles.psInput}
                    placeholder="Ex: 2025-05"
                    placeholderTextColor={theme.textMuted}
                    value={psForm.month}
                    onChangeText={v => setPsForm(f => ({ ...f, month: v }))}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                  />
                  <Text style={styles.psLabel}>DESCRIÇÃO (opcional)</Text>
                  <TextInput
                    style={styles.psInput}
                    placeholder="Ex: Holerite maio/2025"
                    placeholderTextColor={theme.textMuted}
                    value={psForm.description}
                    onChangeText={v => setPsForm(f => ({ ...f, description: v }))}
                  />
                  <Text style={styles.psLabel}>URL DO ARQUIVO *</Text>
                  <TextInput
                    style={styles.psInput}
                    placeholder="https://..."
                    placeholderTextColor={theme.textMuted}
                    value={psForm.file_url}
                    onChangeText={v => setPsForm(f => ({ ...f, file_url: v }))}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.psSaveBtn, (!psForm.month || !psForm.file_url || psSaving) && { opacity: 0.4 }]}
                    disabled={!psForm.month || !psForm.file_url || psSaving}
                    onPress={async () => {
                      setPsSaving(true);
                      try {
                        await createPayslip({ employee_id: Number(id), month: psForm.month, description: psForm.description || undefined, file_url: psForm.file_url });
                        setPayslipModal(false);
                        loadPayslips();
                      } catch (e: any) { Alert.alert('Erro', e?.message); }
                      finally { setPsSaving(false); }
                    }}
                  >
                    {psSaving
                      ? <ActivityIndicator size="small" color={theme.bg} />
                      : <Text style={styles.psSaveBtnText}>Salvar Holerite</Text>
                    }
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* Botão onboarding */}
            {canEdit && (
              <TouchableOpacity
                style={styles.btnOnboarding}
                onPress={async () => {
                  try {
                    const proc = await startOnboarding(Number(id));
                    router.push(`/onboarding/${proc.id}` as any);
                  } catch (e: any) {
                    Alert.alert('Erro', e?.message ?? 'Não foi possível iniciar o onboarding');
                  }
                }}
              >
                <Ionicons name="rocket-outline" size={15} color={theme.info} />
                <Text style={styles.btnOnboardingText}>Iniciar Onboarding</Text>
              </TouchableOpacity>
            )}

            {/* Botão excluir */}
            {canDelete && (
              <TouchableOpacity style={styles.btnDelete} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={15} color={theme.danger} />
                <Text style={styles.btnDeleteText}>Excluir colaborador</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Modo edição ──────────────────────────────────────── */}
        {editing && (
          <View style={styles.formWrap}>
            <Text style={styles.fLabel}>Nome *</Text>
            <TextInput style={styles.fInput} value={form.name} onChangeText={v => set('name', v)} placeholderTextColor={theme.textMuted} />

            <Text style={styles.fLabel}>Cargo *</Text>
            <TextInput style={styles.fInput} value={form.role_title} onChangeText={v => set('role_title', v)} placeholderTextColor={theme.textMuted} />

            <Text style={styles.fLabel}>Status</Text>
            <View style={styles.chipGroup}>
              {STATUS_OPTIONS.map(o => (
                <TouchableOpacity key={o.key}
                  style={[styles.chip, form.status === o.key && styles.chipActive]}
                  onPress={() => set('status', o.key)}
                >
                  <Text style={[styles.chipTxt, form.status === o.key && styles.chipTxtActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fLabel}>Área jurídica</Text>
            <View style={styles.chipGroup}>
              {LEGAL_AREAS.map(o => (
                <TouchableOpacity key={o.key}
                  style={[styles.chip, form.legal_area === o.key && styles.chipActive]}
                  onPress={() => set('legal_area', form.legal_area === o.key ? undefined : o.key)}
                >
                  <Text style={[styles.chipTxt, form.legal_area === o.key && styles.chipTxtActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fLabel}>Número OAB</Text>
            <TextInput style={styles.fInput} value={form.oab_number} onChangeText={v => set('oab_number', v)} placeholder="SP 123456" placeholderTextColor={theme.textMuted} />

            <Text style={styles.fLabel}>Telefone</Text>
            <TextInput style={styles.fInput} value={form.phone} onChangeText={v => set('phone', v)} placeholder="(11) 99999-9999" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />

            <Text style={styles.fLabel}>CPF</Text>
            <TextInput style={styles.fInput} value={form.cpf} onChangeText={v => set('cpf', v)} placeholder="000.000.000-00" placeholderTextColor={theme.textMuted} />

            <Text style={styles.fLabel}>Admissão (DD/MM/AAAA)</Text>
            <TextInput style={styles.fInput} value={form.hire_date}
              onChangeText={v => set('hire_date', maskDate(v))}
              placeholder="01/01/2024" placeholderTextColor={theme.textMuted}
              keyboardType="numeric" maxLength={10}
            />

            <Text style={styles.fLabel}>Nascimento (DD/MM/AAAA)</Text>
            <TextInput style={styles.fInput} value={form.birth_date}
              onChangeText={v => set('birth_date', maskDate(v))}
              placeholder="01/01/1990" placeholderTextColor={theme.textMuted}
              keyboardType="numeric" maxLength={10}
            />

            <Text style={styles.fLabel}>Dias de férias disponíveis</Text>
            <TextInput style={styles.fInput}
              value={String(form.vacation_days ?? '')}
              onChangeText={v => set('vacation_days', parseInt(v) || 0)}
              keyboardType="number-pad" placeholderTextColor={theme.textMuted}
            />

            {canSeeSalary && (
              <>
                <Text style={styles.fLabel}>Salário base (R$)</Text>
                <TextInput style={styles.fInput}
                  value={form.salary as string}
                  onChangeText={v => set('salary', v)}
                  placeholder="5000.00" placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setEditing(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.btnSaveTxt}>Salvar alterações</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function ColaboradorScreen() {
  return (
    <ErrorBoundary>
      <ColaboradorScreenInner />
    </ErrorBoundary>
  );
}

// ── Estilos ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },

  fullCenter: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.bg, padding: 32, gap: 12,
  },
  loadingText: { fontSize: 14, color: theme.textMuted, marginTop: 8 },
  errorTitle:  { fontSize: 17, fontWeight: '700', color: theme.white, marginTop: 8 },
  errorMsg:    { fontSize: 13, color: theme.textMuted, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: theme.border2,
    backgroundColor: theme.goldDim,
  },
  retryText:    { fontSize: 14, color: theme.gold, fontWeight: '600' },
  backLink:     { marginTop: 4 },
  backLinkText: { fontSize: 13, color: theme.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn:   { padding: 6 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.white, marginHorizontal: 8 },

  body: { flex: 1 },

  // Perfil
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    padding: 20, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  avatarWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: theme.goldDim, borderWidth: 2, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 24, fontWeight: '800', color: theme.goldLight },
  profileMeta:  { flex: 1, gap: 2 },
  profileName:  { fontSize: 17, fontWeight: '700', color: theme.white },
  profileRole:  { fontSize: 13, color: theme.textLight },
  profileDept:  { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  profileOab:   { fontSize: 11, color: theme.gold, fontFamily: 'monospace', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  statCard: {
    flex: 1, alignItems: 'center', gap: 3,
    paddingVertical: 10,
    backgroundColor: theme.surface2,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  statCardToday:    { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  statCardDisabled: { opacity: 0.5 },
  statEmoji:  { fontSize: 16 },
  statValue:  { fontSize: 13, fontWeight: '700', color: theme.white },
  statLabel:  { fontSize: 10, color: theme.textMuted },

  // Seção
  section: {
    marginHorizontal: 14, marginTop: 14,
    backgroundColor: theme.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface2,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.gold, letterSpacing: 0.8, textTransform: 'uppercase' },

  // InfoRow
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  infoIcon:    { marginRight: 12 },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 10, color: theme.textMuted, letterSpacing: 0.6, marginBottom: 1, textTransform: 'uppercase' },
  infoValue:   { fontSize: 14, color: theme.text, fontWeight: '500' },

  // Férias
  vacRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  vacInfo:     { alignItems: 'center', minWidth: 56 },
  vacDays:     { fontSize: 28, fontWeight: '800', color: theme.gold },
  vacLabel:    { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
  vacBarWrap:  { flex: 1 },
  vacBarBg: {
    height: 8, borderRadius: 4,
    backgroundColor: theme.surface3,
    overflow: 'hidden', marginBottom: 6,
  },
  vacBarFill:  { height: '100%', borderRadius: 4, backgroundColor: theme.gold },
  vacSubLabel: { fontSize: 11, color: theme.textMuted },

  // Ausências
  emptyAbs:     { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyAbsText: { fontSize: 13, color: theme.textMuted },
  absRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  absType:      { fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 2 },
  absDates:     { fontSize: 11, color: theme.textMuted },
  absReason:    { fontSize: 11, color: theme.textMuted, marginTop: 2, fontStyle: 'italic' },
  absBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  absBadgeText: { fontSize: 10, fontWeight: '700' },

  // Botão excluir
  btnOnboarding: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 14, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: `${theme.info}44`,
    backgroundColor: `${theme.info}0C`,
  },
  btnOnboardingText: { fontSize: 14, color: theme.info, fontWeight: '600' },

  btnDelete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 10, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: `${theme.danger}30`,
  },
  btnDeleteText: { fontSize: 14, color: theme.danger, fontWeight: '600' },

  // Holerites
  sectionHeaderRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  addPayslipBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: theme.border2 },
  addPayslipText:    { fontSize: 11, color: theme.gold, fontWeight: '600' },
  payslipRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  payslipMonth:      { fontSize: 13, fontWeight: '700', color: theme.white, textTransform: 'capitalize' },
  payslipDesc:       { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  viewPayslipBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: `${theme.info}15` },
  viewPayslipText:   { fontSize: 12, color: theme.info, fontWeight: '700' },
  delPayslipBtn:     { padding: 6 },

  // Modal holerite
  psModal:       { flex: 1, backgroundColor: theme.bg },
  psModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  psModalTitle:  { fontSize: 16, fontWeight: '800', color: theme.white },
  psModalBody:   { padding: 16, gap: 4 },
  psLabel:       { fontSize: 9, color: theme.textMuted, fontWeight: '800', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  psInput:       { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, color: theme.white, fontSize: 14 },
  psSaveBtn:     { marginTop: 24, backgroundColor: theme.gold, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  psSaveBtnText: { fontSize: 15, fontWeight: '800', color: theme.bg },

  // Form (edição)
  formWrap:   { padding: 16, gap: 0 },
  fLabel: {
    fontSize: 11, color: theme.textMuted, fontWeight: '600',
    letterSpacing: 0.5, marginBottom: 6, marginTop: 16, textTransform: 'uppercase',
  },
  fInput: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: theme.text,
  },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  chipActive:    { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  chipTxt:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  chipTxtActive: { color: theme.gold },

  formActions: {
    flexDirection: 'row', gap: 10,
    marginTop: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  btnCancel:    { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  btnCancelTxt: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  btnSave:      { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.gold, alignItems: 'center' },
  btnSaveTxt:   { fontSize: 14, fontWeight: '700', color: '#000' },
});
