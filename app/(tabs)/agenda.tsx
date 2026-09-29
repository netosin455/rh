import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventsByMonth, createEvent } from '../../conexoes/eventos';
import { getEmployees } from '../../conexoes/colaboradores';
import { Event, EventCategory, EVENT_CATEGORY_COLORS, CreateEventData, Employee } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { getTodayString, toDateString, formatDateDisplay, ymd } from '../../helpers/datas';
import { downloadICS } from '../../helpers/ics';
import { useToast } from '../../contextos/Toast';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
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
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');
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
    } catch (e) {
      console.error('[Agenda]', e);
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

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(f => ({ ...f, date: selected }));
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.title.trim()) { setFormError('Informe o título do evento.'); return; }
    if (!form.date)         { setFormError('Informe a data do evento.'); return; }

    setSaving(true);
    try {
      const data: CreateEventData = {
        title:       form.title.trim(),
        date:        form.date,
        start_time:  form.start_time || undefined,
        end_time:    form.end_time || undefined,
        category:    form.category,
        color:       EVENT_CATEGORY_COLORS[form.category],
        location:    form.location.trim() || undefined,
        description: form.description.trim() || undefined,
        is_all_day:  form.is_all_day,
      };
      const created = await createEvent(data);
      setEvents(prev => [...prev, created]);
      setShowModal(false);
      toast.success('Evento adicionado à agenda!');
      setForm({ title: '', date: today, start_time: '', end_time: '', category: 'outro', location: '', description: '', is_all_day: false });
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
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
          {selectedEvents.length === 0 && selectedBirthdays.length === 0 ? <Card><EmptyState icon="calendar-outline" title="Nenhum evento neste dia" description="Adicione um evento para organizar este prazo." action={<Button label="Adicionar evento" icon="add" onPress={openModal} />} /></Card> : null}
          {selectedEvents.length > 0 ? <Card padded={false}>{selectedEvents.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')).map((event) => <ListRow key={event.id} title={event.title} description={[event.start_time ? `${event.start_time}${event.end_time ? ` – ${event.end_time}` : ''}` : '', event.location, event.description].filter(Boolean).join(' · ')} leading={<View style={styles.eventIcon}><Ionicons name="calendar-outline" size={tamanho.iconeMedio} color={cores.status.informacao.forte} /></View>} trailing={<Badge label={CATEGORY_LABELS[event.category] || event.category} tone={categoryTone[event.category]} />} />)}</Card> : null}
        </Section>
      </ScrollView>
      <Modal visible={showModal} title="Novo evento" subtitle="Audiência, reunião, prazo ou outro." onClose={() => setShowModal(false)} footer={<View style={styles.modalActions}><Button label="Cancelar" variant="secondary" onPress={() => setShowModal(false)} style={styles.actionButton} /><Button label="Salvar evento" loading={saving} onPress={handleSave} style={styles.actionButton} /></View>}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Input label="Título" placeholder="Ex.: Audiência — Processo 0012847" value={form.title} onChangeText={(value) => setF('title', value)} error={formError && !form.title.trim() ? formError : undefined} />
          <Input label="Data (AAAA-MM-DD)" placeholder="2024-07-15" value={form.date} onChangeText={(value) => setF('date', value)} error={formError && !form.date ? formError : undefined} />
          <Section title="Categoria"><View style={styles.optionGroup}>{CATEGORY_OPTIONS.map((option) => <Button key={option.key} label={option.label} variant={form.category === option.key ? 'primary' : 'secondary'} accessibilityLabel={`Selecionar ${option.label}`} onPress={() => setF('category', option.key)} />)}</View></Section>
          <View style={styles.timeInputs}><Input label="Início (HH:mm)" placeholder="09:00" value={form.start_time} onChangeText={(value) => setF('start_time', value)} containerStyle={styles.timeInput} /><Input label="Fim (HH:mm)" placeholder="10:30" value={form.end_time} onChangeText={(value) => setF('end_time', value)} containerStyle={styles.timeInput} /></View>
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
  eventIcon: { alignItems: 'center', backgroundColor: cores.status.informacao.superficie, borderRadius: raio.pill, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  timeInputs: { flexDirection: 'row', gap: espaco.md },
  timeInput: { flex: 1 },
  textarea: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  errorCard: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  errorContent: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  errorText: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
  actionButton: { flex: 1 },
});
