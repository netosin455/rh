import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Avatar } from '../../componentes/Avatar';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { getAlerts } from '../../conexoes/analytics';
import { countAbsences, countPendentes } from '../../conexoes/ausencias';
import { getNotices } from '../../conexoes/avisos';
import { getEmployees } from '../../conexoes/colaboradores';
import { getUpcomingEvents } from '../../conexoes/eventos';
import { buscarInsights, Insight } from '../../conexoes/insights';
import { buscarNotificacoes } from '../../conexoes/notificacoes';
import { useAuth } from '../../contextos/Autenticacao';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { useMotion } from '../../estilo/movimento';
import { tipografia } from '../../estilo/tipografia';
import { formatDateDisplay, getTodayString, ymd } from '../../helpers/datas';
import { Employee, Event, Notice, ProactiveAlert } from '../../tipos/modelos';

const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const APPROVER_ROLES = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];
const INSIGHT_ROLES = ['super_admin', 'admin', 'rh'];

type AttentionLevel = 'urgent' | 'important';

type AttentionItem = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  level: AttentionLevel;
  route?: string;
};

function employeeStatusTone(status: string): 'success' | 'info' | 'pending' | 'muted' {
  if (status === 'ativo') return 'success';
  if (status === 'ferias' || status.startsWith('licenca')) return 'info';
  if (status === 'afastado') return 'pending';
  return 'muted';
}

function employeeStatusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function insightColor(severity: Insight['severity']) {
  if (severity === 'high') return cores.status.erro.forte;
  if (severity === 'medium') return cores.status.pendente.forte;
  return cores.status.informacao.forte;
}

function AttentionCard({ item, onPress }: { item: AttentionItem; onPress: () => void }) {
  const urgent = item.level === 'urgent';

  return (
    <Card
      accessibilityLabel={`${item.title}. ${item.description}`}
      onPress={onPress}
      padded={false}
      style={[styles.attentionCard, urgent ? styles.attentionUrgent : styles.attentionImportant]}
    >
      <View style={styles.attentionContent}>
        <View style={[styles.attentionIcon, urgent ? styles.attentionIconUrgent : styles.attentionIconImportant]}>
          <Ionicons color={urgent ? cores.status.erro.forte : cores.status.pendente.forte} name={item.icon} size={tamanho.iconeMedio} />
        </View>
        <View style={styles.attentionCopy}>
          <Text style={styles.attentionTitle}>{item.title}</Text>
          <Text style={styles.attentionDescription}>{item.description}</Text>
        </View>
        <StatusPill label={urgent ? 'Urgente' : 'Importante'} status={urgent ? 'danger' : 'pending'} />
        <Ionicons color={urgent ? cores.status.erro.forte : cores.status.pendente.forte} name="chevron-forward" size={tamanho.iconePequeno} />
      </View>
    </Card>
  );
}

function DashboardLoading() {
  return (
    <ScrollView contentContainerStyle={styles.loadingContent} style={styles.screen}>
      <Skeleton height={espaco.tela} />
      <Skeleton height={tamanho.toqueMinimo} />
      <View style={styles.skeletonMetrics}>
        <Skeleton height={espaco.tela * 2} />
        <Skeleton height={espaco.tela * 2} />
      </View>
      <Skeleton height={espaco.tela * 3} />
    </ScrollView>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const motion = useMotion();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [faltaCount, setFaltaCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const canSeeInsights = INSIGHT_ROLES.includes(user?.role ?? '');

  const load = useCallback(async () => {
    // Sem sessão o AuthGuard redireciona para login: não chamar a API evita erros falsos.
    if (!user) return;

    try {
      const [employeeList, eventList, noticeList] = await Promise.all([
        getEmployees(),
        getUpcomingEvents(5),
        getNotices().catch(() => [] as Notice[]),
      ]);
      setEmployees(employeeList);
      setEvents(eventList);
      setNotices(noticeList);
      getAlerts().then(setAlerts).catch(() => {});
      const currentMonth = getTodayString().slice(0, 7);
      countAbsences('falta', currentMonth).then(setFaltaCount).catch(() => {});
      if (APPROVER_ROLES.includes(user.role ?? '')) countPendentes().then(setPendentesCount).catch(() => {});
      buscarNotificacoes().then((result) => setUnreadCount(result.unread)).catch(() => {});
      if (canSeeInsights) {
        setInsightsLoading(true);
        buscarInsights().then((result) => setInsights(result.insights)).catch(() => {}).finally(() => setInsightsLoading(false));
      }
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canSeeInsights, user?.role]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const today = getTodayString();
  const todayName = WEEKDAY_NAMES[new Date(`${today}T00:00:00`).getDay()];
  const activeEmployees = employees.filter((employee) => employee.status === 'ativo').length;
  const employeesOnVacation = employees.filter((employee) => employee.status === 'ferias').length;
  const onLeave = employees.filter((employee) => employee.status === 'licenca' || employee.status === 'afastado').length;
  const birthdayWindow = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T00:00:00`);
    date.setDate(date.getDate() + index);
    return {
      mmdd: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      label: index === 0 ? 'Hoje' : WEEKDAY_NAMES[date.getDay()],
    };
  });
  const upcomingBirthdays = employees
    .filter((employee) => employee.birth_date && birthdayWindow.some((day) => ymd(employee.birth_date!).slice(5) === day.mmdd))
    .map((employee) => ({
      ...employee,
      birthdayLabel: birthdayWindow.find((day) => ymd(employee.birth_date!).slice(5) === day.mmdd)!.label,
    }));
  const attentionItems: AttentionItem[] = [
    ...alerts.filter((alert) => alert.severity === 'alta').map((alert, index) => ({
      id: `urgent-alert-${index}`,
      title: alert.title,
      description: alert.description ?? 'Este alerta requer revisão.',
      icon: alert.icon as keyof typeof Ionicons.glyphMap,
      level: 'urgent' as const,
      route: `/${alert.route}`,
    })),
    ...(canSeeInsights && pendentesCount > 0 ? [{
      id: 'pending-vacations',
      title: `${pendentesCount} solicitação${pendentesCount === 1 ? '' : 'ões'} de férias pendente${pendentesCount === 1 ? '' : 's'}`,
      description: 'Revise os pedidos da equipe.',
      icon: 'time-outline' as const,
      level: 'important' as const,
      route: '/(tabs)/ferias',
    }] : []),
    ...(faltaCount > 0 ? [{
      id: 'monthly-absences',
      title: `${faltaCount} falta${faltaCount === 1 ? '' : 's'} registrada${faltaCount === 1 ? '' : 's'} no mês`,
      description: 'Consulte as ausências para acompanhar a equipe.',
      icon: 'alert-circle-outline' as const,
      level: 'important' as const,
      route: '/(tabs)/ferias',
    }] : []),
    ...alerts.filter((alert) => alert.severity !== 'alta').map((alert, index) => ({
      id: `important-alert-${index}`,
      title: alert.title,
      description: alert.description ?? 'Há um item para acompanhar.',
      icon: alert.icon as keyof typeof Ionicons.glyphMap,
      level: 'important' as const,
      route: `/${alert.route}`,
    })),
  ];
  const insightsVisible = insightsExpanded || insightsLoading;
  const insightsProgress = useSharedValue(insightsVisible ? 1 : 0);
  const insightsHeight = Math.max(espaco.tela, insights.length * (tamanho.toqueMinimo + espaco.lg));

  useEffect(() => {
    const target = insightsVisible ? 1 : 0;
    if (motion.reduzMovimento) {
      insightsProgress.value = target;
      return;
    }
    insightsProgress.value = withTiming(target, { duration: motion.duracao('normal'), easing: motion.entrada });
  }, [insightsProgress, insightsVisible, motion]);

  const insightContentStyle = useAnimatedStyle(() => ({
    maxHeight: insightsHeight * insightsProgress.value,
    opacity: insightsProgress.value,
  }));

  if (loading) return <DashboardLoading />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={cores.accent.dourado} />}
      style={styles.screen}
    >
      <ScreenHeader
        eyebrow={todayName}
        title={`Olá, ${user?.name?.split(' ')[0] || 'Usuário'}`}
        subtitle={formatDateDisplay(today)}
        action={
          <View style={styles.notificationAction}>
            <Button
              accessibilityLabel={unreadCount > 0 ? `Abrir notificações, ${unreadCount} não lidas` : 'Abrir notificações'}
              icon="notifications-outline"
              onPress={() => router.navigate('/notificacoes' as never)}
              variant="ghost"
            />
            {unreadCount > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
          </View>
        }
      />

      {attentionItems.length > 0 ? (
        <Section title="Precisa de atenção">
          <View style={styles.attentionStack}>
            {attentionItems.map((item) => <AttentionCard item={item} key={item.id} onPress={() => router.navigate(item.route as never)} />)}
          </View>
        </Section>
      ) : null}

      <Section title="Métricas principais">
        <View style={styles.metrics}>
          <View style={styles.metricItem}><MetricCard indicator={<Ionicons color={cores.status.sucesso.forte} name="people-outline" size={tamanho.iconeMedio} />} label="Ativos" value={activeEmployees} /></View>
          <View style={styles.metricItem}><MetricCard indicator={<Ionicons color={cores.status.informacao.forte} name="umbrella-outline" size={tamanho.iconeMedio} />} label="Em férias" value={employeesOnVacation} /></View>
          <View style={styles.metricItem}><MetricCard indicator={<Ionicons color={faltaCount > 0 ? cores.status.erro.forte : cores.accent.douradoProfundo} name="close-circle-outline" size={tamanho.iconeMedio} />} label="Faltas no mês" value={faltaCount} /></View>
          <View style={styles.metricItem}><MetricCard indicator={<Ionicons color={onLeave > 0 ? cores.status.pendente.forte : cores.status.informacao.forte} name="medical-outline" size={tamanho.iconeMedio} />} label="Em licença" value={onLeave} /></View>
        </View>
      </Section>

      <Section action={<Button accessibilityLabel="Abrir agenda" label="Ver agenda" onPress={() => router.navigate('/(tabs)/agenda')} variant="ghost" />} title="Próximos eventos">
        <Card padded={false} style={styles.listCard}>
          {events.length === 0 ? <EmptyState description="Sua agenda está livre nos próximos dias." icon="calendar-outline" title="Nenhum evento próximo" /> : events.slice(0, 4).map((event) => (
            <ListRow
              description={`${event.date === today ? 'Hoje' : formatDateDisplay(event.date)}${event.start_time ? ` · ${event.start_time}` : ''}`}
              key={event.id}
              leading={<View style={styles.eventIcon}><Ionicons color={cores.status.informacao.forte} name="calendar-outline" size={tamanho.iconePequeno} /></View>}
              title={event.title}
            />
          ))}
        </Card>
      </Section>

      <Section action={<Button accessibilityLabel="Abrir equipe" label="Ver equipe" onPress={() => router.navigate('/(tabs)/colaboradores')} variant="ghost" />} title="Equipe">
        <Card padded={false} style={styles.listCard}>
          {employees.length === 0 ? <EmptyState description="Adicione a primeira pessoa à sua equipe." icon="people-outline" title="Nenhum colaborador cadastrado" /> : employees.slice(0, 4).map((employee) => (
            <ListRow
              accessibilityLabel={`Abrir perfil de ${employee.name}`}
              description={employee.role_title}
              key={employee.id}
              leading={<Avatar name={employee.name} />}
              onPress={() => router.navigate(`/colaborador/${employee.id}` as never)}
              title={employee.name}
              trailing={<StatusPill label={employeeStatusLabel(employee.status)} status={employeeStatusTone(employee.status)} />}
            />
          ))}
        </Card>
      </Section>

      {canSeeInsights && (insightsLoading || insights.length > 0) ? (
        <Section
          action={
            <View style={styles.insightActions}>
              <Button accessibilityLabel={insightsExpanded ? 'Ocultar insights da IA' : 'Mostrar insights da IA'} label={insightsExpanded ? 'Ocultar' : 'Mostrar'} onPress={() => setInsightsExpanded((expanded) => !expanded)} variant="ghost" />
              <Button accessibilityLabel="Atualizar insights da IA" icon="refresh" onPress={() => {
                setInsightsLoading(true);
                buscarInsights(true).then((result) => setInsights(result.insights)).catch(() => {}).finally(() => setInsightsLoading(false));
              }} variant="ghost" />
            </View>
          }
          title="Insights"
        >
          <Card padded={false} style={styles.listCard}>
            <Animated.View pointerEvents={insightsVisible ? 'auto' : 'none'} style={[styles.insightContent, insightContentStyle]}>
              {insightsLoading && insights.length === 0 ? (
                <View style={styles.insightLoading}><Skeleton /><Skeleton /></View>
              ) : insights.map((insight, index) => (
                <ListRow
                  accessibilityLabel={`Abrir insight: ${insight.title}`}
                  description={insight.description}
                  key={`${insight.title}-${index}`}
                  leading={<View style={[styles.insightMarker, { backgroundColor: insightColor(insight.severity) }]} />}
                  onPress={insight.action_route ? () => router.navigate(insight.action_route as never) : undefined}
                  title={insight.title}
                  trailing={insight.action_route ? <Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} /> : undefined}
                />
              ))}
            </Animated.View>
          </Card>
        </Section>
      ) : null}

      {upcomingBirthdays.length > 0 || notices.length > 0 ? (
        <Section title="Contexto da equipe">
          {upcomingBirthdays.length > 0 ? (
            <Card padded={false} style={styles.listCard}>
              {upcomingBirthdays.slice(0, 4).map((employee) => (
                <ListRow description={employee.birthdayLabel} key={employee.id} leading={<View style={styles.birthdayIcon}><Ionicons color={cores.accent.douradoProfundo} name="gift-outline" size={tamanho.iconePequeno} /></View>} title={employee.name} />
              ))}
            </Card>
          ) : null}
          {notices.length > 0 ? (
            <Card padded={false} style={styles.listCard}>
              {notices.slice(0, 3).map((notice) => (
                <ListRow accessibilityLabel={`Abrir aviso: ${notice.title}`} description={notice.body} key={notice.id} onPress={() => router.navigate('/(tabs)/avisos')} title={notice.title} trailing={<Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} />} />
              ))}
            </Card>
          ) : null}
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.xxxl, padding: espaco.lg, paddingBottom: espaco.tela },
  loadingContent: { gap: espaco.lg, padding: espaco.lg, paddingBottom: espaco.tela },
  skeletonMetrics: { flexDirection: 'row', gap: espaco.md },
  notificationAction: { position: 'relative' },
  notificationBadge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro, position: 'absolute', right: -espaco.xs, top: -espaco.xs },
  notificationBadgeText: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
  attentionStack: { gap: espaco.sm },
  attentionCard: { overflow: 'hidden' },
  attentionUrgent: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  attentionImportant: { backgroundColor: cores.status.pendente.superficie, borderColor: cores.status.pendente.borda },
  attentionContent: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo + espaco.lg, padding: espaco.lg },
  attentionIcon: { alignItems: 'center', borderRadius: raio.pill, height: tamanho.avatarMedio, justifyContent: 'center', width: tamanho.avatarMedio },
  attentionIconUrgent: { backgroundColor: cores.superficie.elevada },
  attentionIconImportant: { backgroundColor: cores.superficie.elevada },
  attentionCopy: { flex: 1, gap: espaco.micro },
  attentionTitle: { ...tipografia.corpoForte, color: cores.texto.primario },
  attentionDescription: { ...tipografia.legenda, color: cores.texto.secundario },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  metricItem: { flexGrow: 1, flexBasis: espaco.tela * 2 },
  listCard: { overflow: 'hidden' },
  eventIcon: { alignItems: 'center', backgroundColor: cores.status.informacao.superficie, borderRadius: raio.controle, height: tamanho.avatarMedio, justifyContent: 'center', width: tamanho.avatarMedio },
  birthdayIcon: { alignItems: 'center', backgroundColor: cores.accent.superficie, borderRadius: raio.controle, height: tamanho.avatarMedio, justifyContent: 'center', width: tamanho.avatarMedio },
  insightActions: { alignItems: 'center', flexDirection: 'row', gap: espaco.micro },
  insightContent: { overflow: 'hidden' },
  insightLoading: { gap: espaco.sm, padding: espaco.lg },
  insightMarker: { borderRadius: raio.pill, height: tamanho.indicador, width: tamanho.indicador },
});
