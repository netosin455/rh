// ============================================================
// app/(tabs)/index.tsx — SuperRH Dashboard
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { getEmployees } from '../../conexoes/colaboradores';
import { getUpcomingEvents } from '../../conexoes/eventos';
import { getAbsences } from '../../conexoes/ausencias';
import { getCases } from '../../conexoes/casos';
import { getNotices } from '../../conexoes/avisos';
import { Employee, Event, Absence, LegalCase, Notice } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { formatDateDisplay, getTodayString, ymd } from '../../helpers/datas';

function MetricCard({
  label, value, sub, accent, delay,
}: {
  label: string; value: string | number; sub?: string; accent?: string; delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} style={styles.metricCard}>
      <View style={styles.metricGoldBar} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : {}]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </Animated.View>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDot} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.sectionLink}>Ver todos →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ativo:     theme.success,
  ferias:    theme.info,
  licenca:   theme.warning,
  afastado:  theme.warning,
  desligado: theme.textMuted,
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [events,     setEvents]     = useState<Event[]>([]);
  const [absences,   setAbsences]   = useState<Absence[]>([]);
  const [cases,      setCases]      = useState<LegalCase[]>([]);
  const [notices,    setNotices]    = useState<Notice[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [emp, evt, abs, cas, ntc] = await Promise.all([
        getEmployees(),
        getUpcomingEvents(5),
        getAbsences('pendente'),
        getCases().catch(() => [] as LegalCase[]),
        getNotices().catch(() => [] as Notice[]),
      ]);
      setEmployees(emp);
      setEvents(evt);
      setAbsences(abs);
      setCases(cas);
      setNotices(ntc);
    } catch (err) {
      console.error('[Dashboard] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const activeEmployees = employees.filter(e => e.status === 'ativo').length;
  const pendingAbsences = absences.length;

  const today = getTodayString();

  const upcomingBirthdays = (() => {
    const DAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const base = new Date(today + 'T00:00:00');
    const window: { mmdd: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      window.push({ mmdd, label: i === 0 ? 'Hoje' : DAYS[d.getDay()] });
    }
    return employees
      .filter(e => e.birth_date && window.some(w => ymd(e.birth_date!).slice(5) === w.mmdd))
      .map(e => ({
        ...e,
        birthdayLabel: window.find(w => ymd(e.birth_date!).slice(5) === w.mmdd)!.label,
      }))
      .sort((a, b) => {
        const ai = window.findIndex(w => a.birth_date!.slice(5) === w.mmdd);
        const bi = window.findIndex(w => b.birth_date!.slice(5) === w.mmdd);
        return ai - bi;
      });
  })();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
    >
      <Animated.View entering={FadeInDown.duration(300)} style={styles.greeting}>
        <Text style={styles.greetingLabel}>BOM DIA,</Text>
        <Text style={styles.greetingName}>{user?.name?.split(' ')[0] || 'Usuário'}</Text>
        <Text style={styles.greetingDate}>{formatDateDisplay(today)}</Text>
      </Animated.View>

      <View style={styles.goldDivider} />

      <View style={styles.metricsGrid}>
        <MetricCard label="COLABORADORES" value={activeEmployees} sub="ativos" delay={0} />
        <MetricCard label="EM FÉRIAS" value={employees.filter(e => e.status === 'ferias').length} sub="colaboradores" delay={80} />
        <MetricCard label="EVENTOS HOJE" value={events.filter(e => e.date === today).length} sub="agendados" delay={160} />
        <MetricCard
          label="FÉRIAS PEND." value={pendingAbsences} sub="aguardando"
          accent={pendingAbsences > 0 ? theme.warning : undefined} delay={240}
        />
        <MetricCard label="PROCESSOS" value={cases.filter(c => c.status !== 'encerrado').length} sub="ativos" delay={320} />
        <MetricCard
          label="URGENTES" value={cases.filter(c => c.status === 'urgente').length} sub="processos"
          accent={cases.some(c => c.status === 'urgente') ? theme.danger : undefined} delay={400}
        />
      </View>

      {upcomingBirthdays.length > 0 && (
        <Animated.View entering={FadeInDown.delay(280).duration(350)} style={styles.birthdayCard}>
          <Text style={styles.birthdayIcon}>🎂</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.birthdayTitle}>Aniversários próximos</Text>
            {upcomingBirthdays.slice(0, 5).map(e => (
              <Text key={e.id} style={styles.birthdayNames}>
                <Text style={styles.birthdayDay}>{e.birthdayLabel}: </Text>{e.name}
              </Text>
            ))}
            {upcomingBirthdays.length > 5 && (
              <Text style={styles.birthdayMore}>+{upcomingBirthdays.length - 5} mais</Text>
            )}
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.card}>
        <SectionHeader title="Próximos eventos" onPress={() => router.push('/(tabs)/agenda')} />
        {events.length === 0 ? (
          <Text style={styles.empty}>Nenhum evento próximo</Text>
        ) : (
          events.slice(0, 4).map(evt => (
            <TouchableOpacity key={evt.id} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: evt.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventName}>{evt.title}</Text>
                <Text style={styles.eventMeta}>
                  {evt.date === today ? 'Hoje' : formatDateDisplay(evt.date)}
                  {evt.start_time ? ` · ${evt.start_time}` : ''}
                  {evt.location ? ` · ${evt.location}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(360).duration(350)} style={styles.card}>
        <SectionHeader title="Colaboradores" onPress={() => router.push('/(tabs)/colaboradores')} />
        {employees.slice(0, 4).map(emp => (
          <TouchableOpacity key={emp.id} style={styles.empRow}>
            <View style={styles.empAvatar}>
              <Text style={styles.empInitials}>
                {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{emp.name}</Text>
              <Text style={styles.empRole}>{emp.role_title}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[emp.status] || theme.success}20` }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[emp.status] || theme.success }]}>
                {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {notices.length > 0 && (
        <Animated.View entering={FadeInDown.delay(420).duration(350)} style={styles.card}>
          <SectionHeader title="Avisos recentes" onPress={() => router.push('/(tabs)/avisos')} />
          {notices.slice(0, 3).map(n => (
            <TouchableOpacity key={n.id} style={styles.eventRow} onPress={() => router.push('/(tabs)/avisos')}>
              <View style={[styles.eventDot, {
                backgroundColor: n.priority === 'urgente' ? theme.danger : n.priority === 'importante' ? theme.warning : theme.info,
              }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventName}>{n.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{n.body}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },
  greeting: { paddingHorizontal: 4, paddingTop: 8, marginBottom: 16 },
  greetingLabel: { fontSize: 10, color: theme.gold, letterSpacing: 2, fontWeight: '600', marginBottom: 2 },
  greetingName: { fontSize: 22, fontWeight: '700', color: theme.white, marginBottom: 2 },
  greetingDate: { fontSize: 12, color: theme.textMuted },
  goldDivider: { height: 1, backgroundColor: theme.gold, opacity: 0.2, marginBottom: 16, marginHorizontal: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: theme.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border,
    padding: 14, overflow: 'hidden', position: 'relative',
  },
  metricGoldBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: theme.gold, opacity: 0.5 },
  metricLabel: { fontSize: 9, color: theme.gold, letterSpacing: 1.5, fontWeight: '600', marginBottom: 6 },
  metricValue: { fontSize: 26, fontWeight: '700', color: theme.white },
  metricSub: { fontSize: 11, color: theme.textMuted, marginTop: 3 },
  birthdayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    borderRadius: 10, padding: 14, marginBottom: 14,
  },
  birthdayIcon: { fontSize: 24 },
  birthdayTitle: { fontSize: 12, color: theme.gold, fontWeight: '600', marginBottom: 4 },
  birthdayNames: { fontSize: 13, color: theme.text, marginBottom: 1 },
  birthdayDay:   { color: theme.gold, fontWeight: '600' },
  birthdayMore:  { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  card: { backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, marginBottom: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.gold },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.white, flex: 1 },
  sectionLink: { fontSize: 11, color: theme.gold },
  empty: { fontSize: 13, color: theme.textMuted, padding: 14 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  eventName: { fontSize: 13, color: theme.text, fontWeight: '500' },
  eventMeta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  empRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  empAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, alignItems: 'center', justifyContent: 'center' },
  empInitials: { fontSize: 11, fontWeight: '600', color: theme.goldLight },
  empName: { fontSize: 13, color: theme.text, fontWeight: '500' },
  empRole: { fontSize: 11, color: theme.textMuted },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
});
