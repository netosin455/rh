import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getEmployeeById, updateEmployee, deleteEmployee } from '../../conexoes/colaboradores';
import { startOnboarding } from '../../conexoes/onboarding';
import { createPayslip, deletePayslip, getPayslips } from '../../conexoes/holerites';
import { apiFetch } from '../../conexoes/http';
import { Absence, ABSENCE_TYPE_LABELS, Employee, EmployeeStatus, LegalArea, Payslip, STATUS_LABELS } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { useToast } from '../../contextos/Toast';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { Modal } from '../../componentes/Modal';
import { ProgressBar } from '../../componentes/ProgressBar';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { ymd, brToIso, isoToBr, maskDate } from '../../helpers/datas';
import { confirmAction } from '../../helpers/confirm';

const STATUS_OPTIONS: { key: EmployeeStatus; label: string }[] = [{ key: 'ativo', label: 'Ativo' }, { key: 'afastado', label: 'Afastado' }, { key: 'desligado', label: 'Desligado' }];
const LEGAL_AREAS: { key: LegalArea; label: string }[] = [{ key: 'civel', label: 'Cível' }, { key: 'trabalhista', label: 'Trabalhista' }, { key: 'tributario', label: 'Tributário' }, { key: 'familia', label: 'Família' }, { key: 'criminal', label: 'Criminal' }, { key: 'empresarial', label: 'Empresarial' }, { key: 'outro', label: 'Outro' }];

function formatDate(value?: string | null) { if (!value) return '—'; const [year, month, day] = ymd(value).split('-'); return year && month && day ? `${day}/${month}/${year}` : value; }
function tenure(value: string) { const start = new Date(`${ymd(value)}T00:00:00`); const now = new Date(); let years = now.getFullYear() - start.getFullYear(); let months = now.getMonth() - start.getMonth(); if (months < 0) { years--; months += 12; } return years > 0 ? `${years} ano${years > 1 ? 's' : ''}${months ? ` e ${months} mês${months > 1 ? 'es' : ''}` : ''}` : `${months} mês${months !== 1 ? 'es' : ''}`; }
function age(value: string) { const birth = new Date(`${ymd(value)}T00:00:00`); const now = new Date(); let result = now.getFullYear() - birth.getFullYear(); if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) result--; return result; }
function statusTone(status: EmployeeStatus): 'ativo' | 'licenca' | 'inativo' { return status === 'ativo' ? 'ativo' : status === 'desligado' ? 'inativo' : 'licenca'; }
function absenceTone(status: string): 'success' | 'pending' | 'danger' | 'muted' { return status === 'aprovado' ? 'success' : status === 'pendente' ? 'pending' : status === 'recusado' ? 'danger' : 'muted'; }

export default function ColaboradorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = ['super_admin', 'admin', 'rh', 'adm'].includes(user?.role ?? '');
  const canDelete = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canSeeSalary = canEdit;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [absLoading, setAbsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payslipModal, setPayslipModal] = useState(false);
  const [psSaving, setPsSaving] = useState(false);
  const [form, setForm] = useState<Partial<Employee & { salary: string }>>({});
  const [psForm, setPsForm] = useState({ month: '', description: '', file_url: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const emp = await getEmployeeById(Number(id)); setEmployee(emp); setForm({ name: emp.name, role_title: emp.role_title, hire_date: isoToBr(emp.hire_date), status: emp.status, phone: emp.phone ?? '', email: emp.email ?? '', cpf: emp.cpf ?? '', birth_date: emp.birth_date ? isoToBr(emp.birth_date) : '', legal_area: emp.legal_area, oab_number: emp.oab_number ?? '', vacation_days: emp.vacation_days, folga_hours: emp.folga_hours, salary: emp.salary != null ? String(emp.salary) : '' }); }
    catch (cause: any) { setError(cause.message || 'Não foi possível carregar o colaborador.'); }
    finally { setLoading(false); }
  }, [id]);
  const loadAbsences = useCallback(async () => { setAbsLoading(true); try { const data = await apiFetch<any>(`/api/absences?employee_id=${id}`); setAbsences(Array.isArray(data) ? data : data?.data ?? []); } catch { setAbsences([]); } finally { setAbsLoading(false); } }, [id]);
  const loadPayslips = useCallback(async () => { try { setPayslips(await getPayslips(Number(id))); } catch { setPayslips([]); } }, [id]);
  useEffect(() => { load(); loadAbsences(); loadPayslips(); }, [load, loadAbsences, loadPayslips]);
  const set = (field: string, value: any) => setForm((current) => ({ ...current, [field]: value }));

  async function save() {
    if (!form.name?.trim()) return toast.warning('Informe o nome.'); if (!form.role_title?.trim()) return toast.warning('Informe o cargo.');
    const hireDate = brToIso(form.hire_date ?? ''); const birthDate = form.birth_date ? brToIso(form.birth_date) : '';
    if (!hireDate) return toast.warning('Admissão: use DD/MM/AAAA.'); if (form.birth_date && !birthDate) return toast.warning('Nascimento: use DD/MM/AAAA.');
    setSaving(true);
    try { const salary = form.salary ? parseFloat(String(form.salary).replace(',', '.')) : undefined; const updated = await updateEmployee(Number(id), { name: form.name.trim(), role_title: form.role_title.trim(), hire_date: hireDate, status: form.status, phone: form.phone?.trim() || undefined, email: form.email?.trim() ?? '', cpf: form.cpf?.trim() || undefined, birth_date: birthDate || undefined, legal_area: form.legal_area, oab_number: form.oab_number?.trim() || undefined, vacation_days: form.vacation_days, folga_hours: form.folga_hours, salary: !isNaN(salary!) ? salary : undefined }); setEmployee(updated); setEditing(false); toast.success('Colaborador atualizado!'); }
    catch (cause: any) { toast.error(cause.message || 'Não foi possível salvar.'); } finally { setSaving(false); }
  }
  function removeEmployee() { confirmAction('Excluir colaborador', `Deseja excluir ${employee?.name}? Esta ação não pode ser desfeita.`, async () => { try { await deleteEmployee(Number(id)); router.back(); } catch (cause: any) { toast.error(cause.message || 'Não foi possível excluir.'); } }); }
  async function start() { try { const process = await startOnboarding(Number(id)); router.push(`/onboarding/${process.id}` as any); } catch (cause: any) { toast.error(cause.message || 'Não foi possível iniciar o onboarding'); } }
  async function savePayslip() { setPsSaving(true); try { await createPayslip({ employee_id: Number(id), month: psForm.month, description: psForm.description || undefined, file_url: psForm.file_url }); setPayslipModal(false); loadPayslips(); toast.success('Holerite adicionado!'); } catch (cause: any) { toast.error(cause.message || 'Erro ao salvar holerite'); } finally { setPsSaving(false); } }

  if (loading) return <View style={styles.center}><Skeleton height={espaco.tela} /><Skeleton height={espaco.gigante} /><Skeleton height={espaco.gigante} /></View>;
  if (error || !employee) return <View style={styles.center}><EmptyState icon="person-outline" title="Colaborador não encontrado" description={error || 'Verifique sua conexão e tente novamente.'} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} /><Button icon="arrow-back-outline" label="Voltar" onPress={() => router.back()} variant="ghost" /></View>;

  const vacationDays = employee.vacation_days ?? 0; const vacationUsed = Math.max(0, 30 - vacationDays); const legalArea = employee.legal_area ? LEGAL_AREAS.find((item) => item.key === employee.legal_area)?.label : null;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ScreenHeader title={editing ? 'Editar colaborador' : employee.name} subtitle={editing ? 'Atualize os dados cadastrais.' : [employee.role_title, employee.department_name].filter(Boolean).join(' · ')} action={<View style={styles.headerActions}><Button accessibilityLabel="Voltar" icon="arrow-back-outline" onPress={() => router.back()} variant="ghost" />{canEdit ? <Button icon={editing ? 'close-outline' : 'pencil-outline'} label={editing ? 'Cancelar' : 'Editar'} onPress={() => setEditing((value) => !value)} variant="secondary" /> : null}</View>} />
    {editing ? <Card><View style={styles.form}>
      <Input editable={!saving} label="Nome *" value={form.name} onChangeText={(value) => set('name', value)} />
      <Input editable={!saving} label="Cargo *" value={form.role_title} onChangeText={(value) => set('role_title', value)} />
      <Section title="Status"><View style={styles.choices}>{STATUS_OPTIONS.map((item) => <Button key={item.key} label={item.label} onPress={() => set('status', item.key)} disabled={saving} style={styles.choice} variant={form.status === item.key ? 'primary' : 'secondary'} />)}</View></Section>
      <Section title="Área jurídica"><View style={styles.choices}>{LEGAL_AREAS.map((item) => <Button key={item.key} label={item.label} onPress={() => set('legal_area', form.legal_area === item.key ? undefined : item.key)} disabled={saving} style={styles.choice} variant={form.legal_area === item.key ? 'primary' : 'secondary'} />)}</View></Section>
      <Input editable={!saving} label="Número OAB" value={form.oab_number} onChangeText={(value) => set('oab_number', value)} placeholder="SP 123456" />
      <Input editable={!saving} keyboardType="phone-pad" label="Telefone" value={form.phone} onChangeText={(value) => set('phone', value)} placeholder="(11) 99999-9999" />
      <Input autoCapitalize="none" autoCorrect={false} editable={!saving} keyboardType="email-address" label="Email" value={form.email} onChangeText={(value) => set('email', value)} placeholder="nome@empresa.com" />
      <Input editable={!saving} label="CPF" value={form.cpf} onChangeText={(value) => set('cpf', value)} placeholder="000.000.000-00" />
      <Input editable={!saving} keyboardType="numeric" label="Admissão (DD/MM/AAAA)" maxLength={10} value={form.hire_date} onChangeText={(value) => set('hire_date', maskDate(value))} />
      <Input editable={!saving} keyboardType="numeric" label="Nascimento (DD/MM/AAAA)" maxLength={10} value={form.birth_date} onChangeText={(value) => set('birth_date', maskDate(value))} />
      <Input editable={!saving} keyboardType="number-pad" label="Dias de férias disponíveis" value={String(form.vacation_days ?? '')} onChangeText={(value) => set('vacation_days', parseInt(value) || 0)} />
      <Input editable={!saving} keyboardType="decimal-pad" label="Banco de horas de folga" value={String(form.folga_hours ?? '')} onChangeText={(value) => set('folga_hours', parseFloat(value.replace(',', '.')) || 0)} />
      {canSeeSalary ? <Input editable={!saving} keyboardType="decimal-pad" label="Salário base (R$)" value={form.salary as string} onChangeText={(value) => set('salary', value)} /> : null}
      <View style={styles.formActions}><Button label="Cancelar" onPress={() => setEditing(false)} style={styles.flex} variant="secondary" disabled={saving} /><Button label="Salvar alterações" onPress={save} style={styles.flex} loading={saving} /></View>
    </View></Card> : <>
      <Card><ListRow title={employee.name} description={[employee.role_title, employee.department_name, employee.oab_number ? `OAB ${employee.oab_number}` : null].filter(Boolean).join(' · ')} leading={<Avatar name={employee.name} size="large" />} trailing={<StatusPill label={STATUS_LABELS[employee.status]} status={statusTone(employee.status)} />} /></Card>
      <View style={styles.metrics}><View style={styles.metric}><MetricCard label="Tempo de casa" value={tenure(employee.hire_date)} detail="Desde a admissão" /></View><View style={styles.metric}><MetricCard label="Férias" value={`${vacationDays} dias`} detail={`${vacationUsed} dias usados`} /></View><View style={styles.metric}><MetricCard label="Banco de horas" value={`${employee.folga_hours ?? 0}h`} detail="Folga disponível" /></View></View>
      <Section title="Dados pessoais"><Card padded={false}><ListRow title="CPF" description={employee.cpf || 'Não informado'} /><ListRow title="Email" description={employee.email || 'Não informado'} /><ListRow title="Nascimento" description={employee.birth_date ? `${formatDate(employee.birth_date)} · ${age(employee.birth_date)} anos` : 'Não informado'} />{employee.phone ? <ListRow title="Telefone" description={employee.phone} trailing={<Button accessibilityLabel="Ligar para colaborador" icon="call-outline" onPress={() => Linking.openURL(`tel:${employee.phone}`)} variant="ghost" />} /> : <ListRow title="Telefone" description="Não informado" />}</Card></Section>
      <Section title="Dados profissionais"><Card padded={false}><ListRow title="Admissão" description={formatDate(employee.hire_date)} /><ListRow title="Área jurídica" description={legalArea || 'Não informada'} /><ListRow title="OAB" description={employee.oab_number || 'Não informado'} />{canSeeSalary && employee.salary != null ? <ListRow title="Salário base" description={`R$ ${Number(employee.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} /> : null}</Card></Section>
      <Section title="Férias" description={`${vacationUsed} dias usados de 30.`}><Card><ProgressBar value={(vacationUsed / 30) * 100} accessibilityLabel="Férias utilizadas" /></Card></Section>
      <Section title="Histórico de ausências">{absLoading ? <Card><Skeleton accessibilityLabel="Carregando ausências" /></Card> : absences.length === 0 ? <EmptyState icon="checkmark-circle-outline" title="Nenhuma ausência registrada" /> : <Card padded={false}>{absences.map((absence) => <ListRow key={absence.id} title={ABSENCE_TYPE_LABELS[absence.type]} description={`${formatDate(absence.start_date)} a ${formatDate(absence.end_date)} · ${absence.hours != null ? `${absence.hours}h` : `${absence.days_count} dia${absence.days_count !== 1 ? 's' : ''}`}${absence.reason ? ` · ${absence.reason}` : ''}`} trailing={<StatusPill label={absence.status.charAt(0).toUpperCase() + absence.status.slice(1)} status={absenceTone(absence.status)} />} />)}</Card>}</Section>
      <Section title="Holerites" action={canEdit ? <Button icon="add-outline" label="Adicionar" onPress={() => { setPsForm({ month: '', description: '', file_url: '' }); setPayslipModal(true); }} variant="secondary" /> : undefined}>{payslips.length === 0 ? <EmptyState icon="document-outline" title="Nenhum holerite cadastrado" /> : <Card padded={false}>{payslips.map((payslip) => <ListRow key={payslip.id} title={new Date(`${payslip.month}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} description={payslip.description} trailing={<View style={styles.rowActions}><Button accessibilityLabel="Abrir holerite" icon="open-outline" onPress={() => Linking.openURL(payslip.file_url)} variant="ghost" />{canEdit ? <Button accessibilityLabel="Remover holerite" icon="trash-outline" onPress={() => confirmAction('Remover', 'Remover este holerite?', async () => { try { await deletePayslip(payslip.id); loadPayslips(); } catch (cause: any) { toast.error(cause.message || 'Erro ao remover holerite'); } })} variant="danger" /> : null}</View>} />)}</Card>}</Section>
      {canEdit ? <Button icon="rocket-outline" label="Iniciar onboarding" onPress={start} variant="secondary" /> : null}{canDelete ? <Button icon="trash-outline" label="Excluir colaborador" onPress={removeEmployee} variant="danger" /> : null}
    </>}
  </ScrollView>
  <Modal visible={payslipModal} title="Adicionar holerite" subtitle="Informe o mês e o endereço do arquivo." onClose={() => !psSaving && setPayslipModal(false)} footer={<View style={styles.formActions}><Button label="Cancelar" onPress={() => setPayslipModal(false)} style={styles.flex} variant="secondary" disabled={psSaving} /><Button label="Salvar holerite" onPress={savePayslip} style={styles.flex} loading={psSaving} disabled={!psForm.month || !psForm.file_url} /></View>}><View style={styles.form}><Input autoFocus editable={!psSaving} label="Mês (YYYY-MM) *" value={psForm.month} onChangeText={(value) => setPsForm((current) => ({ ...current, month: value }))} placeholder="2025-05" /><Input editable={!psSaving} label="Descrição" value={psForm.description} onChangeText={(value) => setPsForm((current) => ({ ...current, description: value }))} placeholder="Holerite maio/2025" /><Input autoCapitalize="none" editable={!psSaving} keyboardType="url" label="URL do arquivo *" value={psForm.file_url} onChangeText={(value) => setPsForm((current) => ({ ...current, file_url: value }))} placeholder="https://..." /></View></Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 }, center: { backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.lg, justifyContent: 'center', padding: espaco.xl }, content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela }, headerActions: { flexDirection: 'row', gap: espaco.xs }, metrics: { flexDirection: 'row', gap: espaco.md }, metric: { flex: 1 }, form: { gap: espaco.lg }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm }, choice: { minWidth: espaco.tela }, formActions: { flexDirection: 'row', gap: espaco.md }, flex: { flex: 1 }, rowActions: { flexDirection: 'row', gap: espaco.xs },
});
