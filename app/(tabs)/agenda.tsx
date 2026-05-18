import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getEventsByMonth, createEvent } from '../../conexoes/eventos';
import { getEmployees } from '../../conexoes/colaboradores';
import { Event, EventCategory, EVENT_CATEGORY_COLORS, CreateEventData, Employee } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { getTodayString, toDateString, formatDateDisplay, ymd } from '../../helpers/datas';
import { downloadICS } from '../../helpers/ics';
import { useToast } from '../../contextos/Toast';

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
      {/* Cabeçalho do calendário */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.gold} />
        </TouchableOpacity>
        <View style={styles.monthWrap}>
          <Text style={styles.monthTitle}>{MONTH_NAMES[month]}</Text>
          <Text style={styles.monthYear}>{year}</Text>
        </View>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={theme.gold} />
        </TouchableOpacity>
        {Platform.OS === 'web' && events.length > 0 && (
          <TouchableOpacity
            style={styles.icsBtn}
            onPress={() => {
              downloadICS(events, `agenda-${monthKey}.ics`);
              window.alert(
                'Arquivo .ics baixado!\n\n' +
                'Para importar no Google Calendar:\n' +
                '1. Abra calendar.google.com\n' +
                '2. Configurações (⚙) → Importar e exportar\n' +
                '3. Clique em "Importar" e selecione o arquivo baixado'
              );
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="calendar-outline" size={14} color={theme.gold} />
            <Text style={styles.icsBtnText}>Exportar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dias da semana */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekDay, (i === 0 || i === 6) && styles.weekDayWeekend]}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.loadingGrid}>
          <ActivityIndicator color={theme.gold} />
        </View>
      ) : (
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((dateStr, di) => {
                if (!dateStr) return <View key={di} style={styles.dayCell} />;
                const isToday    = dateStr === today;
                const isSelected = dateStr === selected;
                const dots       = (eventsByDate[dateStr] || []).slice(0, 3);
                const hasBirthday = (birthdaysByDate[dateStr] || []).length > 0;
                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      isToday && !isSelected && styles.dayCellToday,
                    ]}
                    onPress={() => setSelected(dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}>
                      {Number(dateStr.slice(8))}
                    </Text>
                    {(dots.length > 0 || hasBirthday) && (
                      <View style={styles.dotsRow}>
                        {hasBirthday && (
                          <View style={[styles.dot, { backgroundColor: theme.gold }]} />
                        )}
                        {dots.map((e, idx) => (
                          <View key={idx} style={[styles.dot, { backgroundColor: e.color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {/* Header da lista */}
      <View style={styles.eventsHeader}>
        <Text style={styles.eventsTitle}>
          {selected === today ? 'Hoje' : formatDateDisplay(selected)}
        </Text>
        <Text style={styles.eventsCount}>
          {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
          {selectedBirthdays.length > 0 ? ` · ${selectedBirthdays.length} 🎂` : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.eventsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {selectedBirthdays.length > 0 && (
          <View style={styles.birthdaySection}>
            {selectedBirthdays.map(emp => (
              <View key={emp.id} style={styles.birthdayRow}>
                <Text style={styles.birthdayEmoji}>🎂</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.birthdayName}>{emp.name}</Text>
                  <Text style={styles.birthdayRole}>{emp.role_title} · Aniversário</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedEvents.length === 0 && selectedBirthdays.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum evento neste dia</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openModal}>
              <Ionicons name="add" size={14} color={theme.gold} />
              <Text style={styles.emptyAddText}>Adicionar evento</Text>
            </TouchableOpacity>
          </View>
        ) : (
          selectedEvents
            .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
            .map((evt, i) => (
              <Animated.View key={evt.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                <TouchableOpacity style={styles.eventRow} activeOpacity={0.75}>
                  <View style={[styles.eventColor, { backgroundColor: evt.color }]} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{evt.title}</Text>
                    <View style={styles.eventMeta}>
                      {evt.start_time && (
                        <Text style={styles.eventMetaText}>
                          {evt.start_time}{evt.end_time ? ` – ${evt.end_time}` : ''}
                        </Text>
                      )}
                      <View style={[styles.categoryPill, { backgroundColor: `${EVENT_CATEGORY_COLORS[evt.category]}20` }]}>
                        <Text style={[styles.categoryText, { color: EVENT_CATEGORY_COLORS[evt.category] }]}>
                          {CATEGORY_LABELS[evt.category] || evt.category}
                        </Text>
                      </View>
                      {evt.location && <Text style={styles.eventMetaText}>{evt.location}</Text>}
                    </View>
                    {evt.description ? (
                      <Text style={styles.eventDesc} numberOfLines={2}>{evt.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
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
              <Text style={styles.modalTitle}>Novo Evento</Text>
              <Text style={styles.modalSubtitle}>Audiência, reunião, prazo ou outro</Text>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Título *</Text>
            <TextInput style={styles.input} placeholder="Ex: Audiência — Processo 0012847" placeholderTextColor={theme.textMuted} value={form.title} onChangeText={v => setF('title', v)} />

            <Text style={styles.label}>Data * (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} placeholder="2024-07-15" placeholderTextColor={theme.textMuted} value={form.date} onChangeText={v => setF('date', v)} />

            <Text style={styles.label}>Categoria</Text>
            <View style={styles.chipGroup}>
              {CATEGORY_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, form.category === o.key && styles.chipActive]}
                  onPress={() => setF('category', o.key)}
                >
                  <View style={[styles.chipDot, { backgroundColor: EVENT_CATEGORY_COLORS[o.key] }]} />
                  <Text style={[styles.chipText, form.category === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Início (HH:mm)</Text>
                <TextInput style={styles.input} placeholder="09:00" placeholderTextColor={theme.textMuted} value={form.start_time} onChangeText={v => setF('start_time', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Fim (HH:mm)</Text>
                <TextInput style={styles.input} placeholder="10:30" placeholderTextColor={theme.textMuted} value={form.end_time} onChangeText={v => setF('end_time', v)} />
              </View>
            </View>

            <Text style={styles.label}>Local</Text>
            <TextInput style={styles.input} placeholder="Ex: Fórum Central, Sala 5" placeholderTextColor={theme.textMuted} value={form.location} onChangeText={v => setF('location', v)} />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Detalhes do evento..."
              placeholderTextColor={theme.textMuted}
              value={form.description}
              onChangeText={v => setF('description', v)}
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

  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  navBtn:     { padding: 6 },
  icsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  icsBtnText: { fontSize: 10, color: theme.gold, fontWeight: '700' },
  monthWrap:  { alignItems: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: theme.white },
  monthYear:  { fontSize: 11, color: theme.gold, letterSpacing: 1 },

  weekRow:        { flexDirection: 'row' },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 10,
    color: theme.textMuted, fontWeight: '700', paddingVertical: 7,
  },
  weekDayWeekend: { color: theme.gold },

  loadingGrid: { height: 200, justifyContent: 'center', alignItems: 'center' },
  grid:        { paddingHorizontal: 8, paddingBottom: 4 },

  dayCell:         { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, padding: 2 },
  dayCellSelected: { backgroundColor: theme.gold },
  dayCellToday:    { backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2 },
  dayText:         { fontSize: 13, color: theme.textLight, fontWeight: '500' },
  dayTextSelected: { color: '#000', fontWeight: '800' },
  dayTextToday:    { color: theme.gold, fontWeight: '800' },
  dotsRow:         { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:             { width: 4, height: 4, borderRadius: 2 },

  divider: { height: 1, backgroundColor: theme.border },

  eventsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  eventsTitle: { fontSize: 14, fontWeight: '700', color: theme.white },
  eventsCount: { fontSize: 11, color: theme.textMuted },

  eventsList: { flex: 1 },
  empty:      { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText:  { fontSize: 13, color: theme.textMuted },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: theme.border2 },
  emptyAddText: { fontSize: 12, color: theme.gold },

  birthdaySection: {
    backgroundColor: theme.goldGlow,
    borderBottomWidth: 1, borderBottomColor: theme.border2,
  },
  birthdayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  birthdayEmoji: { fontSize: 22 },
  birthdayName:  { fontSize: 14, fontWeight: '600', color: theme.white },
  birthdayRole:  { fontSize: 11, color: theme.gold, marginTop: 1 },

  eventRow: {
    flexDirection: 'row', gap: 12, padding: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  eventColor:    { width: 3, borderRadius: 2, minHeight: 40 },
  eventInfo:     { flex: 1 },
  eventTitle:    { fontSize: 14, fontWeight: '700', color: theme.white, marginBottom: 5 },
  eventMeta:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  eventMetaText: { fontSize: 11, color: theme.textMuted },
  categoryPill:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText:  { fontSize: 10, fontWeight: '700' },
  eventDesc:     { fontSize: 12, color: theme.textMuted, marginTop: 5 },

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
  textarea:  { minHeight: 80, textAlignVertical: 'top' },
  timeRow:   { flexDirection: 'row', gap: 12 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive:     { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  chipDot:        { width: 6, height: 6, borderRadius: 3 },
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
