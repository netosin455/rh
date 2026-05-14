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
import { getNotices } from '../../conexoes/avisos';
import { getAlerts } from '../../conexoes/analytics';
import { Employee, Event, Notice, ProactiveAlert } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { formatDateDisplay, getTodayString, ymd } from '../../helpers/datas';

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const STATUS_COLORS: Record<string, string> = {
  ativo:     theme.success,
  ferias:    theme.info,
  licenca:   theme.warning,
  afastado:  theme.warning,
  desligado: theme.textMuted,
};

const QUICK_ACTIONS = [
  { label: 'Colaboradores', icon: 'people-outline',    route: '/(tabs)/colaboradores' as const },
  { label: 'Férias',        icon: 'umbrella-outline',  route: '/(tabs)/ferias'        as const },
  { label: 'Avisos',        icon: 'megaphone-outline', route: '/(tabs)/avisos'        as const },
  { label: 'Agenda',        icon: 'calendar-outline',  route: '/(tabs)/agenda'        as const },
];

function MetricCard({
  label, value, sub, accent, delay, icon,
}: {
  label: string; value: string | number; sub?: string;
  accent?: string; delay: number; icon: string;
}) {
  const color = accent || theme.gold;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </Animated.View>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress} style={styles.sectionLinkBtn}>
          <Text style={styles.sectionLink}>Ver todos</Text>
          <Ionicons name="arrow-forward" size={10} color={theme.gold} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [events,     setEvents]     = useState<Event[]>([]);
  const [notices,    setNotices]    = useState<Notice[]>([]);
  const [alerts,     setAlerts]     = useState<ProactiveAlert[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [emp, evt, ntc] = await Promise.all([
        getEmployees(),
        getUpcomingEvents(5),
        getNotices().catch(() => [] as Notice[]),
      ]);
      setEmployees(emp);
      setEvents(evt);
      setNotices(ntc);
      // Alertas carregam após o render inicial (non-blocking)
      getAlerts().then(setAlerts).catch(() => {});
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
  const onLeave         = employees.filter(e => e.status === 'licenca' || e.status === 'afastado').length;
  const today           = getTodayString();
  const todayName       = WEEKDAY_NAMES[new Date(today + 'T00:00:00').getDay()];

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
      {/* Greeting */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.greeting}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greetingDay}>{todayName}</Text>
          <Text style={styles.greetingName}>{user?.name?.split(' ')[0] || 'Usuário'}</Text>
          <Text style={styles.greetingDate}>{formatDateDisplay(today)}</Text>
        </View>
        <View style={styles.greetingBadge}>
          <Ionicons name="briefcase-outline" size={14} color={theme.gold} />
          <Text style={styles.greetingRole}>{user?.role?.toUpperCase() ?? 'USER'}</Text>
        </View>
      </Animated.View>

      {/* Quick actions */}
      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.quickRow}>
        {QUICK_ACTIONS.map(qa => (
          <TouchableOpacity
            key={qa.route}
            style={styles.quickBtn}
            onPress={() => router.push(qa.route)}
            activeOpacity={0.75}
          >
            <View style={styles.quickIcon}>
              <Ionicons name={qa.icon as any} size={18} color={theme.gold} />
            </View>
            <Text style={styles.quickLabel}>{qa.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard label="Ativos"      value={activeEmployees}
          icon="people"            delay={80}  />
        <MetricCard label="Em Férias"   value={employees.filter(e => e.status === 'ferias').length}
          icon="umbrella"          delay={130} />
        <MetricCard label="Eventos Hoje" value={events.filter(e => e.date === today).length}
          icon="calendar"          delay={180} />
        <MetricCard
          label="Em Licença"   value={onLeave}
          icon="medical"       delay={230}
          accent={onLeave > 0 ? theme.warning : undefined}
        />
      </View>

      {/* Alertas IA */}
      {alerts.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.alertsWrap}>
          <View style={styles.alertsHeader}>
            <Ionicons name="sparkles" size={12} color={theme.gold} />
            <Text style={styles.alertsHeaderText}>ALERTAS INTELIGENTES</Text>
          </View>
          {alerts.map((alert, i) => {
            const color = alert.severity === 'alta' ? theme.danger : theme.warning;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.alertCard, { borderLeftColor: color }]}
                onPress={() => router.push(`/${alert.route}` as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.alertIconWrap, { backgroundColor: `${color}18` }]}>
                  <Ionicons name={alert.icon as any} size={14} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  {alert.description ? (
                    <Text style={styles.alertDesc} numberOfLines={1}>{alert.description}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {/* Aniversários */}
      {upcomingBirthdays.length > 0 && (
        <Animated.View entering={FadeInDown.delay(260).duration(350)} style={styles.birthdayCard}>
          <View style={styles.birthdayLeft}>
            <Text style={styles.birthdayEmoji}>🎂</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.birthdayTitle}>Aniversários próximos</Text>
            {upcomingBirthdays.slice(0, 4).map(e => (
              <Text key={e.id} style={styles.birthdayLine}>
                <Text style={styles.birthdayDay}>{e.birthdayLabel}  </Text>
                {e.name}
              </Text>
            ))}
            {upcomingBirthdays.length > 4 && (
              <Text style={styles.birthdayMore}>+{upcomingBirthdays.length - 4} mais</Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Próximos eventos */}
      <Animated.View entering={FadeInDown.delay(290).duration(350)} style={styles.card}>
        <SectionHeader title="Próximos eventos" onPress={() => router.push('/(tabs)/agenda')} />
        {events.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons name="calendar-outline" size={22} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum evento próximo</Text>
          </View>
        ) : (
          events.slice(0, 4).map(evt => (
            <TouchableOpacity key={evt.id} style={styles.eventRow} activeOpacity={0.7}>
              <View style={[styles.eventColorBar, { backgroundColor: evt.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventName}>{evt.title}</Text>
                <Text style={styles.eventMeta}>
                  {evt.date === today ? 'Hoje' : formatDateDisplay(evt.date)}
                  {evt.start_time ? ` · ${evt.start_time}` : ''}
                  {evt.location ? ` · ${evt.location}` : ''}
                </Text>
              </View>
              <View style={[styles.categoryDot, { backgroundColor: evt.color }]} />
            </TouchableOpacity>
          ))
        )}
      </Animated.View>

      {/* Colaboradores */}
      <Animated.View entering={FadeInDown.delay(340).duration(350)} style={styles.card}>
        <SectionHeader title="Colaboradores" onPress={() => router.push('/(tabs)/colaboradores')} />
        {employees.slice(0, 4).map(emp => (
          <TouchableOpacity
            key={emp.id} style={styles.empRow} activeOpacity={0.7}
            onPress={() => router.push(`/colaborador/${emp.id}` as any)}
          >
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

      {/* Avisos */}
      {notices.length > 0 && (
        <Animated.View entering={FadeInDown.delay(390).duration(350)} style={styles.card}>
          <SectionHeader title="Avisos recentes" onPress={() => router.push('/(tabs)/avisos')} />
          {notices.slice(0, 3).map(n => (
            <TouchableOpacity key={n.id} style={styles.eventRow} activeOpacity={0.7} onPress={() => router.push('/(tabs)/avisos')}>
              <View style={[styles.eventColorBar, {
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

  greeting: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16, paddingHorizontal: 2,
  },
  greetingLeft:  {},
  greetingDay:   { fontSize: 10, color: theme.gold, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  greetingName:  { fontSize: 24, fontWeight: '800', color: theme.white, marginBottom: 2 },
  greetingDate:  { fontSize: 12, color: theme.textMuted },
  greetingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  greetingRole: { fontSize: 10, color: theme.gold, fontWeight: '700', letterSpacing: 0.8 },

  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '600', textAlign: 'center', letterSpacing: 0.2 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  metricIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  metricValue: { fontSize: 28, fontWeight: '800', color: theme.gold, marginBottom: 2 },
  metricLabel: { fontSize: 10, color: theme.textLight, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  metricSub:   { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  alertsWrap: {
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14, overflow: 'hidden',
  },
  alertsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  alertsHeaderText: {
    fontSize: 9, fontWeight: '800', color: theme.gold, letterSpacing: 1.5,
  },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
    borderLeftWidth: 3,
  },
  alertIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, color: theme.white, fontWeight: '600', marginBottom: 1 },
  alertDesc:  { fontSize: 11, color: theme.textMuted },

  birthdayCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: theme.goldGlow, borderWidth: 1, borderColor: theme.border2,
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  birthdayLeft:  { paddingTop: 2 },
  birthdayEmoji: { fontSize: 24 },
  birthdayTitle: { fontSize: 11, color: theme.gold, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  birthdayLine:  { fontSize: 13, color: theme.text, marginBottom: 2 },
  birthdayDay:   { color: theme.gold, fontWeight: '600' },
  birthdayMore:  { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  card: {
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: theme.gold },
  sectionTitle:  { fontSize: 13, fontWeight: '800', color: theme.gold, flex: 1, letterSpacing: 0.3 },
  sectionLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionLink:   { fontSize: 11, color: theme.goldLight },

  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, paddingHorizontal: 14,
  },
  emptyText: { fontSize: 13, color: theme.textMuted },

  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  eventColorBar: { width: 3, height: 36, borderRadius: 2 },
  eventName:     { fontSize: 13, color: theme.white, fontWeight: '600', marginBottom: 2 },
  eventMeta:     { fontSize: 11, color: theme.textMuted },
  categoryDot:   { width: 6, height: 6, borderRadius: 3 },

  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  empAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  empInitials: { fontSize: 12, fontWeight: '700', color: theme.gold },
  empName:     { fontSize: 13, color: theme.white, fontWeight: '700' },
  empRole:     { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  statusPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
