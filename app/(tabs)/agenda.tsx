// ============================================================
// app/(tabs)/agenda.tsx — SuperRH
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getEventsByMonth } from '../../services/events';
import { Event, EVENT_CATEGORY_COLORS } from '../../types';
import { theme } from '../../theme';
import { getTodayString, toDateString, formatDateDisplay } from '../../utils/dateUtils';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CATEGORY_LABELS: Record<string, string> = {
  audiencia: 'Audiência',
  reuniao:   'Reunião',
  prazo:     'Prazo',
  pericia:   'Perícia',
  outro:     'Outro',
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
  const today = getTodayString();
  const [year,       setYear]       = useState(new Date().getFullYear());
  const [month,      setMonth]      = useState(new Date().getMonth());
  const [selected,   setSelected]   = useState(today);
  const [events,     setEvents]     = useState<Event[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    try {
      setEvents(await getEventsByMonth(monthKey));
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

  const selectedEvents = eventsByDate[selected] ?? [];
  const weeks = buildCalendar(year, month);

  return (
    <View style={styles.container}>
      {/* Cabeçalho do calendário */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color={theme.gold} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={theme.gold} />
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekDay, (i === 0 || i === 6) && styles.weekDayWeekend]}>
            {d}
          </Text>
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
                    {dots.length > 0 && (
                      <View style={styles.dotsRow}>
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

      {/* Eventos do dia selecionado */}
      <View style={styles.eventsHeader}>
        <Text style={styles.eventsTitle}>
          {selected === today ? 'Hoje' : formatDateDisplay(selected)}
        </Text>
        <Text style={styles.eventsCount}>
          {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.eventsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {selectedEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum evento neste dia</Text>
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
                      {evt.location && (
                        <Text style={styles.eventMetaText}>{evt.location}</Text>
                      )}
                    </View>
                    {evt.description ? (
                      <Text style={styles.eventDesc} numberOfLines={2}>{evt.description}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
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
  navBtn:     { padding: 4 },
  monthTitle: { fontSize: 15, fontWeight: '700', color: theme.white, letterSpacing: 0.5 },

  weekRow:        { flexDirection: 'row' },
  weekDay: {
    flex: 1, textAlign: 'center', fontSize: 10,
    color: theme.textMuted, fontWeight: '600', paddingVertical: 6,
  },
  weekDayWeekend: { color: theme.gold },

  loadingGrid: { height: 200, justifyContent: 'center', alignItems: 'center' },
  grid:        { paddingHorizontal: 8, paddingBottom: 4 },

  dayCell: {
    flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, padding: 2,
  },
  dayCellSelected: { backgroundColor: theme.gold },
  dayCellToday:    { backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2 },
  dayText:         { fontSize: 13, color: theme.textLight, fontWeight: '500' },
  dayTextSelected: { color: '#000', fontWeight: '700' },
  dayTextToday:    { color: theme.gold, fontWeight: '700' },
  dotsRow:         { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:             { width: 4, height: 4, borderRadius: 2 },

  divider: { height: 1, backgroundColor: theme.border, marginVertical: 4 },

  eventsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  eventsTitle: { fontSize: 14, fontWeight: '600', color: theme.white },
  eventsCount: { fontSize: 11, color: theme.textMuted },

  eventsList: { flex: 1 },
  empty:      { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText:  { fontSize: 13, color: theme.textMuted },

  eventRow: {
    flexDirection: 'row', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  eventColor:    { width: 3, borderRadius: 2, minHeight: 40 },
  eventInfo:     { flex: 1 },
  eventTitle:    { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 4 },
  eventMeta:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  eventMetaText: { fontSize: 11, color: theme.textMuted },
  categoryPill:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText:  { fontSize: 10, fontWeight: '600' },
  eventDesc:     { fontSize: 12, color: theme.textMuted, marginTop: 4 },
});
