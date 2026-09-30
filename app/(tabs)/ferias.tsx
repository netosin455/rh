import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAbsences, getPendingAbsences, createAbsence, approveAbsence, updateAbsence, deleteAbsence } from '../../conexoes/ausencias';
import { getEmployees } from '../../conexoes/colaboradores';
import { Absence, AbsenceType, ABSENCE_TYPE_LABELS, CreateAbsenceData, Employee } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { formatDateShort, brToIso, isoToBr, maskDate } from '../../helpers/datas';
import { confirmAction } from '../../helpers/confirm';
import { exportAbsencesPDF } from '../../helpers/pdf';
import { useToast } from '../../contextos/Toast';
import { useAuth } from '../../contextos/Autenticacao';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { Input } from '../../componentes/Input';
import { LancarAusencia } from '../../componentes/LancarAusencia';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { borda, espaco, largura, raio, tamanho } from '../../estilo/espaco';
import { useMotion } from '../../estilo/movimento';
import { tipografia } from '../../estilo/tipografia';

const absenceTone: Record<AbsenceType, 'gold' | 'success' | 'danger' | 'info' | 'muted'> = {
  ferias: 'gold',
  licenca_medica: 'info',
  licenca_maternidade: 'info',
  licenca_paternidade: 'success',
  folga: 'success',
  falta: 'danger',
  outro: 'muted',
};

function absenceDuration(absence: Absence) {
  return absence.hours != null ? `${absence.hours}h` : `${absence.days_count}d`;
}

function absencePeriod(absence: Absence) {
  return `${formatDateShort(absence.start_date)} — ${formatDateShort(absence.end_date)}`;
}

const FILTER_TABS: { key: AbsenceType | 'todos'; label: string }[] = [
  { key: 'todos',              label: 'Todos' },
  { key: 'falta',              label: 'Faltas' },
  { key: 'ferias',             label: 'Férias' },
  { key: 'licenca_medica',     label: 'Médica' },
  { key: 'licenca_maternidade', label: 'Maternidade' },
  { key: 'licenca_paternidade', label: 'Paternidade' },
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
  hours:      '',
};

const CAN_APPROVE = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];

const absenceStatusVisual = {
  pendente: { label: 'Pendente', backgroundColor: cores.status.pendente.superficie, borderColor: cores.status.pendente.borda, color: cores.status.pendente.forte },
  aprovado: { label: 'Aprovado', backgroundColor: cores.status.sucesso.superficie, borderColor: cores.status.sucesso.borda, color: cores.status.sucesso.forte },
  recusado: { label: 'Recusado', backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda, color: cores.status.erro.forte },
  cancelado: { label: 'Cancelado', backgroundColor: cores.superficie.sutil, borderColor: cores.borda.sutil, color: cores.texto.discreto },
} as const;

function AbsenceStatusBadge({ status }: { status: string }) {
  const motion = useMotion();
  const visual = absenceStatusVisual[status as keyof typeof absenceStatusVisual] ?? absenceStatusVisual.pendente;
  const previousStatus = useRef(status);
  const backgroundColor = useSharedValue(visual.backgroundColor);
  const borderColor = useSharedValue(visual.borderColor);
  const color = useSharedValue(visual.color);
  const emphasis = useSharedValue(1);

  useEffect(() => {
    const changed = previousStatus.current !== status;
    previousStatus.current = status;
    const duration = motion.duracao('fast');
    backgroundColor.value = motion.reduzMovimento ? visual.backgroundColor : withTiming(visual.backgroundColor, { duration, easing: motion.entrada });
    borderColor.value = motion.reduzMovimento ? visual.borderColor : withTiming(visual.borderColor, { duration, easing: motion.entrada });
    color.value = motion.reduzMovimento ? visual.color : withTiming(visual.color, { duration, easing: motion.entrada });
    if (changed && !motion.reduzMovimento) {
      emphasis.value = 0.98;
      emphasis.value = withTiming(1, { duration, easing: motion.entrada });
    }
  }, [backgroundColor, borderColor, color, emphasis, motion, status, visual]);

  const badgeStyle = useAnimatedStyle(() => ({
    backgroundColor: backgroundColor.value,
    borderColor: borderColor.value,
    transform: [{ scale: emphasis.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ color: color.value }));

  return (
    <Animated.View accessibilityLabel={visual.label} accessibilityRole="text" style={[styles.statusBadge, badgeStyle]}>
      <Animated.Text style={[styles.statusBadgeText, textStyle]}>{visual.label}</Animated.Text>
    </Animated.View>
  );
}

export default function FeriasScreen() {
  const toast = useToast();
  const { user } = useAuth();
  const canApprove = CAN_APPROVE.includes(user?.role ?? '');
  const canManage = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  const [absences,   setAbsences]   = useState<Absence[]>([]);
  const [pendentes,  setPendentes]  = useState<Absence[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [empNames,   setEmpNames]   = useState<Record<number, string>>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<AbsenceType | 'todos'>('todos');
  const [showModal,  setShowModal]  = useState(false);
  // Novos lançamentos usam a tela única "Lançar"; o modal abaixo ficou só para editar pendentes antigos.
  const [showLancar, setShowLancar] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [empSearch,  setEmpSearch]  = useState('');
  const [formError,  setFormError]  = useState('');
  const [editId,     setEditId]     = useState<number | null>(null);
  const [vacDays,    setVacDays]    = useState<number | null>(null);
  const [folgaHours, setFolgaHours] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [getAbsences(), getEmployees()];
      if (canApprove) promises.push(getPendingAbsences());
      const [abs, emps, pend] = await Promise.all(promises);
      setAbsences(abs);
      setEmployees(emps);
      if (canApprove) setPendentes(pend ?? []);
      setLoadError(false);
      const names: Record<number, string> = {};
      emps.forEach((e: Employee) => { names[e.id] = e.name; });
      setEmpNames(names);
    } catch (e) {
      console.error('[Ferias]', e);
      setLoadError(true);
      toast.error('Não foi possível carregar as ausências.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canApprove]);

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

  function openModal(abs?: Absence) {
    if (abs) {
      setEditId(abs.id);
      setForm({
        employee_id: abs.employee_id,
        type:        abs.type,
        start_date:  isoToBr(abs.start_date),
        end_date:    isoToBr(abs.end_date),
        reason:      abs.reason || '',
        hours:       abs.hours != null ? String(abs.hours) : '',
      });
      setEmpSearch(empNames[abs.employee_id] || '');
      const emp = employees.find(e => e.id === abs.employee_id);
      setVacDays(emp?.vacation_days ?? null);
      setFolgaHours(emp?.folga_hours ?? null);
    } else {
      setEditId(null);
      setForm(EMPTY_FORM);
      setEmpSearch('');
      setVacDays(null);
      setFolgaHours(null);
    }
    setFormError('');
    setShowModal(true);
  }

  async function handleDeleteAbsence(id: number) {
    try {
      await deleteAbsence(id);
      setAbsences(prev => prev.filter(a => a.id !== id));
      setPendentes(prev => prev.filter(a => a.id !== id));
      toast.success('Solicitação excluída.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir.');
    }
  }

  async function handleApprove(id: number, approved: boolean) {
    setApprovingId(id);
    try {
      await approveAbsence(id, approved);
      toast.success(approved ? 'Solicitação aprovada!' : 'Solicitação recusada.');
      // Recarregar lista e pendentes após ação
      const [abs, pend] = await Promise.all([getAbsences(), getPendingAbsences()]);
      setAbsences(abs);
      setPendentes(pend);
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível processar a solicitação.');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleSave() {
    setFormError('');
    const isHourBased = form.type === 'folga' || form.type === 'falta';

    if (!form.employee_id) { setFormError('Selecione o colaborador.'); return; }
    if (!form.start_date)  { setFormError(isHourBased ? 'Informe a data.' : 'Informe a data de início.'); return; }
    if (!isHourBased && !form.end_date) { setFormError('Informe a data de fim.'); return; }

    const startIso = brToIso(form.start_date);
    const endIso    = isHourBased ? startIso : brToIso(form.end_date);
    if (!startIso) { setFormError(isHourBased ? 'Data inválida. Use DD/MM/AAAA.' : 'Data de início inválida. Use DD/MM/AAAA.'); return; }
    if (!endIso)   { setFormError('Data de fim inválida. Use DD/MM/AAAA.'); return; }

    const hoursNum = isHourBased && form.hours.trim() !== '' ? parseFloat(form.hours.replace(',', '.')) : undefined;
    if (hoursNum != null && (!Number.isFinite(hoursNum) || hoursNum <= 0)) {
      setFormError('Horas deve ser um número maior que zero.');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        const updated = await updateAbsence(editId, {
          type: form.type,
          start_date: startIso,
          end_date: endIso,
          reason: form.reason.trim() || undefined,
          hours: hoursNum,
        });
        setAbsences(prev => prev.map(a => a.id === editId ? { ...a, ...updated } : a));
        toast.success('Lançamento atualizado!');
      } else {
        const data: CreateAbsenceData = {
          employee_id: form.employee_id,
          type:        form.type,
          start_date:  startIso,
          end_date:    endIso,
          reason:      form.reason.trim() || undefined,
          hours:       hoursNum,
        };
        const created = await createAbsence(data);
        setAbsences(prev => [created, ...prev]);
        toast.success('Lançamento registrado com sucesso!');
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEmpSearch('');
      setEditId(null);
      setVacDays(null);
      setFolgaHours(null);
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <Skeleton height={espaco.tela} />
          <Skeleton height={tamanho.toqueMinimo} />
          <Skeleton height={espaco.tela} />
          <Skeleton height={espaco.tela} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader title="Férias e ausências" subtitle="Registre afastamentos, acompanhe saldos e decida solicitações pendentes." action={<Button label="Lançar" icon="add" onPress={() => setShowLancar(true)} />} />
        {loadError ? <ErroComRetry mensagem="Não foi possível carregar as ausências." onTentarNovamente={onRefresh} carregando={refreshing} /> : null}
        {canApprove && pendentes.length > 0 ? (
          <Section title="Aguardando aprovação" description={`${pendentes.length} solicitação${pendentes.length === 1 ? '' : 'ões'} requer${pendentes.length === 1 ? '' : 'em'} decisão.`}>
            <View style={styles.pendingList}>
              {pendentes.map((absence) => {
                const employeeName = absence.employee_name || empNames[absence.employee_id] || `Colaborador #${absence.employee_id}`;
                const isProcessing = approvingId === absence.id;
                return (
                  <Card key={absence.id} style={styles.pendingCard}>
                    <View style={styles.pendingHeader}>
                      <View style={styles.pendingCopy}><Text style={styles.employeeName}>{employeeName}</Text><Text style={styles.period}>{absencePeriod(absence)}</Text></View>
                      <AbsenceStatusBadge status={absence.status} />
                    </View>
                    <View style={styles.detailLine}><Badge label={ABSENCE_TYPE_LABELS[absence.type]} tone={absenceTone[absence.type]} /><Text style={styles.duration}>{absenceDuration(absence)}</Text></View>
                    {absence.reason ? <Text numberOfLines={2} style={styles.reason}>{absence.reason}</Text> : null}
                    <View style={styles.pendingActions}>
                      <Button label="Recusar" icon="close" variant="danger" loading={isProcessing} onPress={() => handleApprove(absence.id, false)} style={styles.actionButton} />
                      <Button label="Aprovar" icon="checkmark" loading={isProcessing} onPress={() => handleApprove(absence.id, true)} style={styles.actionButton} />
                    </View>
                  </Card>
                );
              })}
            </View>
          </Section>
        ) : null}
        <Section title="Visão geral">
          <View style={styles.metrics}>
            <MetricCard label="Registros" value={filtered.length} detail={activeTab === 'todos' ? 'Todos os tipos' : FILTER_TABS.find((tab) => tab.key === activeTab)?.label} />
            {canApprove ? <MetricCard label="Pendentes" value={pendentes.length} detail="Aguardando decisão" indicator={pendentes.length > 0 ? <AbsenceStatusBadge status="pendente" /> : undefined} /> : null}
          </View>
        </Section>
        <Section title="Registros" description="Filtre por tipo de afastamento para consultar ou editar solicitações pendentes." action={Platform.OS === 'web' && filtered.length > 0 ? <Button label="Exportar PDF" icon="download-outline" variant="ghost" onPress={() => exportAbsencesPDF(filtered as any)} /> : undefined}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
            {FILTER_TABS.map((tab) => <Button key={tab.key} label={tab.label} variant={activeTab === tab.key ? 'primary' : 'secondary'} accessibilityLabel={`Filtrar por ${tab.label}`} onPress={() => setActiveTab(tab.key)} />)}
          </ScrollView>
          {filtered.length === 0 && !loadError ? (
            <Card><EmptyState icon="umbrella-outline" title="Nenhum registro" description="Não há lançamentos para este filtro." action={<Button label="Lançar" icon="add" onPress={() => setShowLancar(true)} />} /></Card>
          ) : (
            <View style={styles.recordList}>
              {filtered.map((absence) => {
                const employeeName = empNames[absence.employee_id] || absence.employee_name || `Colaborador #${absence.employee_id}`;
                const isEditable = absence.status === 'pendente' && canManage;
                return (
                  <Card key={absence.id} padded={false}>
                    <ListRow title={employeeName} description={absencePeriod(absence)} onPress={isEditable ? () => openModal(absence) : undefined} accessibilityLabel={isEditable ? `Editar ${ABSENCE_TYPE_LABELS[absence.type]} de ${employeeName}` : `${ABSENCE_TYPE_LABELS[absence.type]} de ${employeeName}`} leading={<Avatar name={employeeName} size="small" />} trailing={<View style={styles.rowTrailing}><Badge label={ABSENCE_TYPE_LABELS[absence.type]} tone={absenceTone[absence.type]} /><Text style={styles.duration}>{absenceDuration(absence)}</Text><AbsenceStatusBadge status={absence.status} /></View>} />
                    {absence.reason ? <Text numberOfLines={2} style={styles.recordReason}>{absence.reason}</Text> : null}
                    {isEditable ? <View style={styles.recordActions}><Button label="Editar" icon="pencil-outline" variant="ghost" onPress={() => openModal(absence)} /><Button label="Excluir" icon="trash-outline" variant="danger" onPress={() => confirmAction('Excluir', `Excluir esta solicitação de ${ABSENCE_TYPE_LABELS[absence.type]}?`, () => handleDeleteAbsence(absence.id))} /></View> : null}
                  </Card>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>

      <LancarAusencia
        employees={employees}
        onClose={() => setShowLancar(false)}
        onLancado={() => { void load(); }}
        visible={showLancar}
      />

      <Modal
        visible={showModal}
        title={editId ? 'Editar lançamento' : 'Novo lançamento'}
        subtitle={editId ? 'Altere os dados da solicitação.' : 'Férias, licença ou afastamento.'}
        onClose={() => setShowModal(false)}
        footer={<View style={styles.modalActions}><Button label="Cancelar" variant="secondary" onPress={() => setShowModal(false)} style={styles.actionButton} /><Button label={editId ? 'Salvar alterações' : 'Salvar lançamento'} loading={saving} onPress={handleSave} style={styles.actionButton} /></View>}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Section title="Tipo de lançamento">
              <View style={styles.optionGroup}>{TYPE_OPTIONS.map((option) => <Button key={option.key} label={option.label} variant={form.type === option.key ? 'primary' : 'secondary'} accessibilityLabel={`Selecionar ${option.label}`} onPress={() => setF('type', option.key)} />)}</View>
            </Section>
            <Section title="Colaborador">
              <Input label="Buscar colaborador" placeholder="Digite o nome" value={empSearch} onChangeText={(value) => { setEmpSearch(value); setF('employee_id', 0); }} />
              {empSearch.length > 0 && form.employee_id === 0 ? <Card padded={false}>{filteredEmps.slice(0, 6).map((employee) => <ListRow key={employee.id} title={employee.name} description={employee.role_title} leading={<Avatar name={employee.name} size="small" />} onPress={() => { setF('employee_id', employee.id); setEmpSearch(employee.name); setVacDays(employee.vacation_days); setFolgaHours(employee.folga_hours); }} accessibilityLabel={`Selecionar ${employee.name}`} />)}</Card> : null}
              {form.employee_id > 0 ? <View style={styles.balanceContent}><StatusPill label={empNames[form.employee_id]} status="ativo" />{vacDays != null && form.type === 'ferias' ? <Text style={styles.balanceText}>{vacDays} dia{vacDays !== 1 ? 's' : ''} de férias disponível{vacDays <= 5 ? ' — saldo baixo' : ''}.</Text> : null}{folgaHours != null && form.type === 'folga' ? <Text style={styles.balanceText}>{folgaHours}h de banco de horas disponível{folgaHours <= 2 ? ' — saldo baixo' : ''}.</Text> : null}</View> : null}
            </Section>
            {form.type === 'folga' || form.type === 'falta' ? (
              <Section title="Data e horas">
                <Input label="Data" placeholder="DD/MM/AAAA" value={form.start_date} onChangeText={(value) => setF('start_date', maskDate(value))} keyboardType="numeric" maxLength={10} />
                <Input label={form.type === 'falta' ? 'Horas (opcional)' : 'Horas'} placeholder="Ex.: 4" value={form.hours} onChangeText={(value) => setF('hours', value)} keyboardType="decimal-pad" />
                <Text style={styles.hint}>{form.type === 'folga' ? 'Desconta do banco de horas do colaborador. Deixe em branco para contar o dia inteiro.' : 'Útil para jornadas diferentes de oito horas. Deixe em branco para contar o dia inteiro.'}</Text>
              </Section>
            ) : (
              <Section title="Período"><View style={styles.dateInputs}><Input label="Início" placeholder="DD/MM/AAAA" value={form.start_date} onChangeText={(value) => setF('start_date', maskDate(value))} keyboardType="numeric" maxLength={10} containerStyle={styles.dateInput} /><Input label="Fim" placeholder="DD/MM/AAAA" value={form.end_date} onChangeText={(value) => setF('end_date', maskDate(value))} keyboardType="numeric" maxLength={10} containerStyle={styles.dateInput} /></View></Section>
            )}
            <Section title="Observação" description="Opcional"><Input label="Motivo ou detalhes" placeholder="Descreva o motivo, se necessário" value={form.reason} onChangeText={(value) => setF('reason', value)} multiline numberOfLines={3} inputStyle={styles.textarea} /></Section>
            {formError ? <Card style={styles.errorCard}><View style={styles.errorContent}><Ionicons name="alert-circle-outline" size={tamanho.iconeMedio} color={cores.status.erro.forte} /><Text style={styles.errorText}>{formError}</Text></View></Card> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  loadingContent: { gap: espaco.lg, padding: espaco.xl },
  pendingList: { gap: espaco.md },
  pendingCard: { backgroundColor: cores.status.pendente.superficie, borderColor: cores.status.pendente.borda },
  pendingHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  pendingCopy: { flex: 1, gap: espaco.micro },
  employeeName: { ...tipografia.corpoForte, color: cores.texto.primario },
  period: { ...tipografia.legenda, color: cores.texto.secundario },
  detailLine: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
  duration: { ...tipografia.legenda, color: cores.texto.secundario },
  reason: { ...tipografia.corpo, color: cores.texto.secundario, marginTop: espaco.md },
  pendingActions: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.lg },
  actionButton: { flex: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  filterTabs: { gap: espaco.sm, paddingVertical: espaco.xs },
  recordList: { gap: espaco.sm },
  rowTrailing: { alignItems: 'flex-end', gap: espaco.xs },
  statusBadge: { alignSelf: 'flex-start', borderRadius: raio.pill, borderWidth: borda.fina, paddingHorizontal: espaco.sm, paddingVertical: espaco.xs },
  statusBadgeText: { ...tipografia.legenda },
  recordReason: { ...tipografia.corpo, color: cores.texto.secundario, marginHorizontal: espaco.md, marginBottom: espaco.md },
  recordActions: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', gap: espaco.sm, padding: espaco.md },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  balanceContent: { gap: espaco.xs },
  balanceText: { ...tipografia.legenda, color: cores.texto.accentSobreClaro },
  hint: { ...tipografia.legenda, color: cores.texto.discreto },
  dateInputs: { flexDirection: 'row', gap: espaco.md },
  dateInput: { flex: 1 },
  textarea: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  errorCard: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  errorContent: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  errorText: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
});
