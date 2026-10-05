import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventsByMonth, createEvent, updateEvent, deleteEvent } from '../../conexoes/eventos';
import { confirmAction } from '../../helpers/confirm';
import { getEmployees } from '../../conexoes/colaboradores';
import { Event, EventCategory, EVENT_CATEGORY_COLORS, CreateEventData, Employee } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { getTodayString, toDateString, formatDateDisplay, ymd } from '../../helpers/datas';
import { validarHorarios } from '../../helpers/camposData';
import { downloadICS } from '../../helpers/ics';
import { useToast } from '../../contextos/Toast';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { DateField } from '../../componentes/DateField';
import { EmptyState } from '../../componentes/EmptyState';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { TimeField } from '../../componentes/TimeField';
import { borda, espaco, largura, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CATEGORY_LABELS: Record<EventCategory, string> = {
  audiencia: 'Audiência',
  reuniao:   'Reunião',
  prazo:     'Prazo',
  pericia:   'Perícia',
  outro:     'Outro',
};

const CATEGORY_OPTIONS: { key: EventCategory; label: string }[] = [
  { key: 'audiencia', label: 'Audiência' },
  { key: 'reuniao',   label: 'Reunião' },
  { key: 'prazo',     label: 'Prazo' },
  { key: 'pericia',   label: 'Perícia' },
  { key: 'outro',     label: 'Outro' },
];

const categoryTone: Record<EventCategory, 'gold' | 'success' | 'danger' | 'info' | 'muted'> = {
  audiencia: 'danger',
  reuniao: 'info',
  prazo: 'gold',
  pericia: 'success',
  outro: 'muted',
};

function buildCalendar(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(toDateString(new Date(year, month, d)));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export default function AgendaScreen() {
  const toast = useToast();
  const today = getTodayString();
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [month,      setMonth]      = useState(new Date().getMonth());
  const [selected,   setSelected]   = useState(today);
  const [events,     setEvents]     = useState<Event[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
  // Id do evento em edição (null = criando um novo).
  const [editId,     setEditId]     = useState<string | null>(null);
  // Erros no PRÓPRIO campo (título, data, início, fim), em vez de uma mensagem genérica.
  const [erros,      setErros]      = useState<{ titulo?: string; data?: string; inicio?: string; fim?: string }>({});
  const emAndamento = useRef(false);
  const [form,       setForm]       = useState({
    title:       '',
    date:        today,
    start_time:  '',
    end_time:    '',
    category:    'outro' as EventCategory,
    location:    '',
    description: '',
    is_all_day:  false,
  });

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    try {
      const [evts, emps] = await Promise.all([
        getEventsByMonth(monthKey),
        employees.length === 0 ? getEmployees() : Promise.resolve(employees),
      ]);
      setEvents(evts);
      if (employees.length === 0) setEmployees(emps);
      setLoadError(false);
    } catch (e) {
      console.error('[Agenda]', e);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [events]);

  const birthdaysByDate = useMemo(() => {
    const map: Record<string, Employee[]> = {};
    for (const emp of employees) {
      if (!emp.birth_date) continue;
      const mmdd = ymd(emp.birth_date).slice(5);
      const dateStr = `${year}-${mmdd}`;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(emp);
    }
    return map;
  }, [employees, year]);

  const selectedEvents    = eventsByDate[selected]    ?? [];
  const selectedBirthdays = birthdaysByDate[selected] ?? [];
  const weeks = buildCalendar(year, month);

  function setF(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    // Mexeu no campo: o erro dele sai (volta ao salvar, se continuar errado).
    setErros((atual) => {
      const novo = { ...atual };
      if (field === 'title') novo.titulo = undefined;
      if (field === 'date') novo.data = undefined;
      if (field === 'start_time' || field === 'end_time' || field === 'is_all_day') { novo.inicio = undefined; novo.fim = undefined; }
      return novo;
    });
  }

  // Abrir pelo calendário: o dia tocado já vem preenchido.
  function openModal() {
    setEditId(null);
    setForm({ title: '', date: selected, start_time: '', end_time: '', category: 'outro', location: '', description: '', is_all_day: false });
    setFormError('');
    setErros({});
    setShowModal(true);
  }

  // Editar reaproveita o mesmo formulário, já preenchido com o evento.
  function openEdit(event: Event) {
    setEditId(event.id);
    setForm({
      title: event.title,
      date: event.date.slice(0, 10),
      start_time: event.start_time?.slice(0, 5) ?? '',
      end_time: event.end_time?.slice(0, 5) ?? '',
      category: event.category,
      location: event.location ?? '',
      description: event.description ?? '',
      is_all_day: event.is_all_day,
    });
    setFormError('');
    setErros({});
    setShowModal(true);
  }

  function handleDelete(event: Event) {
    confirmAction('Excluir evento', `Excluir o evento "${event.title}"? Não dá para desfazer.`, async () => {
      try {
        await deleteEvent(event.id);
        setEvents(prev => prev.filter(e => e.id !== event.id));
        toast.success('Evento excluído.');
      } catch (e: unknown) {
        toast.error(e instanceof Error && e.message ? e.message : 'Não foi possível excluir o evento.');
      }
    });
  }

  async function handleSave() {
    if (emAndamento.current) return; // evita duplo clique
    setFormError('');
    const novos: typeof erros = {};
    if (!form.title.trim()) novos.titulo = 'Escreva o título do evento.';
    if (!form.date) novos.data = 'Escolha a data do evento.';
    if (!form.is_all_day) {
      if (!form.start_time && form.end_time) novos.inicio = 'Informe o início ou apague o fim.';
      else novos.fim = validarHorarios(form.start_time, form.end_time) ?? undefined;
    }
    if (Object.values(novos).some(Boolean)) { setErros(novos); return; }
    setErros({});

    emAndamento.current = true;
    setSaving(true);
    try {
      const data: CreateEventData = {
        title:       form.title.trim(),
        date:        form.date,
        // Evento de dia inteiro não leva horários.
        start_time:  form.is_all_day ? undefined : form.start_time || undefined,
        end_time:    form.is_all_day ? undefined : form.end_time || undefined,
        category:    form.category,
        color:       EVENT_CATEGORY_COLORS[form.category],
        location:    form.location.trim() || undefined,
        description: form.description.trim() || undefined,
        is_all_day:  form.is_all_day,
      };
      if (editId) {
        const atualizado = await updateEvent(editId, data);
        // A data pode ter mudado de mês: recarrega o mês aberto em vez de mexer na lista na mão.
        setEvents(prev => prev.map(e => (e.id === editId ? { ...e, ...atualizado } : e)));
        setShowModal(false);
        toast.success('Evento atualizado!');
        setEditId(null);
        void load();
        return;
      }
      const created = await createEvent(data);
      setEvents(prev => [...prev, created]);
      setShowModal(false);
      toast.success('Evento adicionado à agenda!');
      setForm({ title: '', date: today, start_time: '', end_time: '', category: 'outro', location: '', description: '', is_all_day: false });
    } catch (e: unknown) {
      setFormError(e instanceof Error && e.message ? e.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader title="Agenda" subtitle="Acompanhe prazos, reuniões e aniversários da equipe." action={<Button label="Novo evento" icon="add" onPress={openModal} />} />
        {loadError ? <ErroComRetry mensagem="Não foi possível carregar a agenda. Os dias sem evento podem estar incompletos." onTentarNovamente={onRefresh} carregando={refreshing} /> : null}
        <Section title={`${MONTH_NAMES[month]} de ${year}`} action={<View style={styles.monthActions}><Button icon="chevron-back" accessibilityLabel="Mês anterior" variant="ghost" onPress={prevMonth} /><Button icon="chevron-forward" accessibilityLabel="Próximo mês" variant="ghost" onPress={nextMonth} /></View>}>
          <Card padded={false}>
            <View style={styles.weekRow}>{WEEKDAYS.map((weekday, index) => <Text key={`${weekday}-${index}`} style={[styles.weekDay, (index === 0 || index === 6) && styles.weekend]}>{weekday}</Text>)}</View>
            {loading ? <View style={styles.loadingCalendar}><Skeleton height={espaco.tela} /></View> : <View style={styles.calendarGrid}>{weeks.map((week, weekIndex) => <View key={weekIndex} style={styles.weekRow}>{week.map((dateString, dayIndex) => {
              if (!dateString) return <View key={dayIndex} style={styles.dayCell} />;
              const isToday = dateString === today;
              const isSelected = dateString === selected;
              const eventCount = (eventsByDate[dateString] || []).length;
              const birthdayCount = (birthdaysByDate[dateString] || []).length;
              return <View key={dayIndex} style={styles.dayCell}><Button label={String(Number(dateString.slice(8)))} variant={isSelected ? 'primary' : 'ghost'} accessibilityLabel={`Selecionar ${formatDateDisplay(dateString)}${eventCount ? `, ${eventCount} evento${eventCount === 1 ? '' : 's'}` : ''}${birthdayCount ? `, ${birthdayCount} aniversário${birthdayCount === 1 ? '' : 's'}` : ''}`} onPress={() => setSelected(dateString)} style={[styles.dayButton, isToday && !isSelected && styles.todayButton]} />{eventCount || birthdayCount ? <View style={styles.dotRow}><View style={[styles.dot, { backgroundColor: birthdayCount ? cores.accent.dourado : cores.status.informacao.forte }]} /></View> : null}</View>;
            })}</View>)}</View>}
          </Card>
        </Section>
        <Section title={selected === today ? 'Hoje' : formatDateDisplay(selected)} description={`${selectedEvents.length} evento${selectedEvents.length === 1 ? '' : 's'}${selectedBirthdays.length ? ` e ${selectedBirthdays.length} aniversário${selectedBirthdays.length === 1 ? '' : 's'}` : ''}.`} action={Platform.OS === 'web' && events.length > 0 ? <Button label="Exportar calendário" icon="download-outline" variant="ghost" onPress={() => { downloadICS(events, `agenda-${monthKey}.ics`); window.alert('Arquivo .ics baixado!\n\nPara importar no Google Calendar:\n1. Abra calendar.google.com\n2. Configurações → Importar e exportar\n3. Clique em Importar e selecione o arquivo baixado'); }} /> : undefined}>
          {selectedBirthdays.length > 0 ? <Card padded={false}>{selectedBirthdays.map((employee) => <ListRow key={employee.id} title={employee.name} description={`${employee.role_title} · Aniversário`} leading={<Avatar name={employee.name} size="small" />} trailing={<Badge label="Aniversário" tone="gold" />} />)}</Card> : null}
          {selectedEvents.length === 0 && selectedBirthdays.length === 0 && !loadError ? <Card><EmptyState icon="calendar-outline" title="Nenhum evento neste dia" description="Adicione um evento para organizar este prazo." action={<Button label="Adicionar evento" icon="add" onPress={openModal} />} /></Card> : null}
          {selectedEvents.length > 0 ? <Card padded={false}>{[...selectedEvents].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')).map((event) => <View key={event.id}><ListRow title={event.title} description={[event.start_time ? `${event.start_time}${event.end_time ? ` – ${event.end_time}` : ''}` : '', event.location, event.description].filter(Boolean).join(' · ')} leading={<View style={styles.eventIcon}><Ionicons name="calendar-outline" size={tamanho.iconeMedio} color={cores.status.informacao.forte} /></View>} trailing={<Badge label={CATEGORY_LABELS[event.category] || event.category} tone={categoryTone[event.category]} />} /><View style={styles.eventActions}><Button accessibilityLabel={`Editar evento ${event.title}`} icon="pencil-outline" label="Editar" onPress={() => openEdit(event)} variant="ghost" /><Button accessibilityLabel={`Excluir evento ${event.title}`} icon="trash-outline" label="Excluir" onPress={() => handleDelete(event)} variant="danger" /></View></View>)}</Card> : null}
        </Section>
      </ScrollView>
      <Modal visible={showModal} title={editId ? 'Editar evento' : 'Novo evento'} subtitle={editId ? 'Altere os dados do evento.' : 'Audiência, reunião, prazo ou outro.'} onClose={() => setShowModal(false)} footer={<View style={styles.modalActions}><Button label="Cancelar" variant="secondary" onPress={() => setShowModal(false)} style={styles.actionButton} /><Button label={editId ? 'Salvar alterações' : 'Salvar evento'} accessibilityLabel={editId ? 'Salvar alterações do evento' : 'Salvar evento'} loading={saving} onPress={handleSave} style={styles.actionButton} /></View>}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Input label="Título" required placeholder="Ex.: Audiência — Processo 0012847" value={form.title} onChangeText={(value) => setF('title', value)} error={erros.titulo} />
          <DateField label="Data" required value={form.date} onChange={(iso) => setF('date', iso)} error={erros.data} />
          <Section title="Categoria"><View style={styles.optionGroup}>{CATEGORY_OPTIONS.map((option) => <Button key={option.key} label={option.label} variant={form.category === option.key ? 'primary' : 'secondary'} accessibilityLabel={`Selecionar ${option.label}`} onPress={() => setF('category', option.key)} />)}</View></Section>
          <View style={styles.diaInteiro}>
            <View style={styles.diaInteiroTexto}>
              <Text style={styles.diaInteiroTitulo}>Dia inteiro</Text>
              <Text style={styles.diaInteiroAjuda}>{form.is_all_day ? 'O evento não tem horário.' : 'Desligado: informe o horário abaixo, se quiser.'}</Text>
            </View>
            <Switch accessibilityLabel="Evento de dia inteiro" onValueChange={(v) => setF('is_all_day', v)} trackColor={{ false: cores.borda.forte, true: cores.accent.dourado }} value={form.is_all_day} />
          </View>
          {form.is_all_day ? null : (
            <View style={styles.timeInputs}>
              <TimeField label="Início" value={form.start_time} onChange={(h) => setF('start_time', h)} error={erros.inicio} containerStyle={styles.timeInput} />
              <TimeField label="Fim" value={form.end_time} onChange={(h) => setF('end_time', h)} error={erros.fim} containerStyle={styles.timeInput} />
            </View>
          )}
          <Input label="Local" placeholder="Ex.: Fórum Central, Sala 5" value={form.location} onChangeText={(value) => setF('location', value)} />
          <Input label="Descrição" placeholder="Detalhes do evento" value={form.description} onChangeText={(value) => setF('description', value)} multiline numberOfLines={3} inputStyle={styles.textarea} />
          {formError ? <Card style={styles.errorCard}><View style={styles.errorContent}><Ionicons name="alert-circle-outline" size={tamanho.iconeMedio} color={cores.status.erro.forte} /><Text style={styles.errorText}>{formError}</Text></View></Card> : null}
        </ScrollView></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  monthActions: { flexDirection: 'row', gap: espaco.xs },
  weekRow: { flexDirection: 'row' },
  weekDay: { ...tipografia.legenda, color: cores.texto.discreto, flex: 1, paddingVertical: espaco.sm, textAlign: 'center' },
  weekend: { color: cores.texto.accentSobreClaro },
  loadingCalendar: { padding: espaco.lg },
  calendarGrid: { padding: espaco.xs },
  dayCell: { alignItems: 'center', flex: 1, minHeight: tamanho.toqueMinimo },
  dayButton: { alignSelf: 'stretch', minWidth: 0, paddingHorizontal: espaco.xs },
  todayButton: { backgroundColor: cores.accent.superficie, borderColor: cores.accent.borda, borderWidth: borda.fina },
  dotRow: { marginTop: espaco.micro },
  dot: { borderRadius: raio.pill, height: tamanho.indicador, width: tamanho.indicador },
  eventActions: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', gap: espaco.xs, justifyContent: 'flex-end', padding: espaco.sm },
  eventIcon: { alignItems: 'center', backgroundColor: cores.status.informacao.superficie, borderRadius: raio.pill, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  timeInputs: { flexDirection: 'row', gap: espaco.md },
  diaInteiro: { alignItems: 'center', flexDirection: 'row', gap: espaco.md },
  diaInteiroTexto: { flex: 1, gap: espaco.micro },
  diaInteiroTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  diaInteiroAjuda: { ...tipografia.legenda, color: cores.texto.discreto },
  timeInput: { flex: 1 },
  textarea: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  errorCard: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  errorContent: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  errorText: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
  actionButton: { flex: 1 },
});
