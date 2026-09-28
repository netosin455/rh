import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Avatar } from '../../componentes/Avatar';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ListRow } from '../../componentes/ListRow';
import { ProgressBar } from '../../componentes/ProgressBar';
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
  const { width } = useWindowDimensions();
  const compact = width <= 768;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [faltaCount, setFaltaCount] = useState(0);
  const [pendentesCount, setPendentesCount] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);
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
  const availabilityPercentage = employees.length > 0 ? Math.round((activeEmployees / employees.length) * 100) : 0;
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
  const reviewRoute = attentionItems[0]?.route ?? '/notificacoes';
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
        title={`Olá, ${user?.name?.split(' ')[0] || 'Usuário'}`}
        subtitle={`${todayName} · ${formatDateDisplay(today)}`}
      />

      <View style={[styles.overviewRow, compact && styles.overviewRowCompact]}>
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Equipe hoje</Text>
            <StatusPill label={`${availabilityPercentage}% disponível`} status="ativo" />
          </View>
          <Text style={styles.overviewValue}>{employees.length}</Text>
          <Text style={styles.overviewDescription}>{activeEmployees} pessoa{activeEmployees === 1 ? '' : 's'} disponível{activeEmployees === 1 ? '' : 'eis'} hoje</Text>
          <ProgressBar accessibilityLabel={`${availabilityPercentage}% da equipe disponível hoje`} tone="success" value={availabilityPercentage} />
        </Card>
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>Precisa de você</Text>
            <StatusPill label={attentionItems.length > 0 ? 'Revisar' : 'Em dia'} status={attentionItems.length > 0 ? 'pendente' : 'ativo'} />
          </View>
          <Text style={styles.overviewValue}>{attentionItems.length}</Text>
          <Text style={styles.overviewDescription}>pendência{attentionItems.length === 1 ? '' : 's'} para acompanhar</Text>
          <Button label="Revisar" onPress={() => router.navigate(reviewRoute as never)} style={styles.reviewAction} variant="ghost" />
        </Card>
      </View>

      {attentionItems.length > 0 ? (
        <Section title="Precisa de atenção">
          <Card padded={false} style={styles.listCard}>
            {attentionItems.map((item) => {
              const urgent = item.level === 'urgent';
              return <ListRow accessibilityLabel={`${item.title}. ${item.description}`} description={item.description} key={item.id} leading={<View style={[styles.attentionIndicator, urgent ? styles.attentionIndicatorUrgent : styles.attentionIndicatorImportant]}><Ionicons color={urgent ? cores.status.erro.forte : cores.status.pendente.forte} name={item.icon} size={tamanho.iconePequeno} /></View>} onPress={() => router.navigate(item.route as never)} title={item.title} trailing={<Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} />} />;
            })}
          </Card>
        </Section>
      ) : null}

      <View style={[styles.dualColumns, compact && styles.dualColumnsCompact]}>
        <View style={styles.dualColumn}>
          <Section action={<Button accessibilityLabel="Abrir agenda" label="Ver agenda" onPress={() => router.navigate('/(tabs)/agenda')} variant="ghost" />} title="Próximos eventos">
            <Card padded={false} style={styles.listCard}>
              {events.length === 0 ? <EmptyState description="Sua agenda está livre nos próximos dias." icon="calendar-outline" title="Nenhum evento próximo" /> : events.slice(0, 4).map((event) => (
                <ListRow description={`${event.date === today ? 'Hoje' : formatDateDisplay(event.date)}${event.start_time ? ` · ${event.start_time}` : ''}`} key={event.id} leading={<View style={styles.eventIcon}><Ionicons color={cores.status.informacao.forte} name="calendar-outline" size={tamanho.iconePequeno} /></View>} title={event.title} />
              ))}
            </Card>
          </Section>
        </View>
        <View style={styles.dualColumn}>
          <Section title="Aniversários">
            <Card padded={false} style={styles.listCard}>
              {upcomingBirthdays.length === 0 ? <EmptyState description="Não há aniversários nos próximos sete dias." icon="gift-outline" title="Sem aniversários próximos" /> : upcomingBirthdays.slice(0, 4).map((employee) => (
                <ListRow description={employee.birthdayLabel} key={employee.id} leading={<Avatar name={employee.name} />} title={employee.name} />
              ))}
            </Card>
          </Section>
        </View>
      </View>

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

      {notices.length > 0 ? (
        <Section title="Contexto da equipe">
          <Card padded={false} style={styles.listCard}>
            {notices.slice(0, 3).map((notice) => (
              <ListRow accessibilityLabel={`Abrir aviso: ${notice.title}`} description={notice.body} key={notice.id} onPress={() => router.navigate('/(tabs)/avisos')} title={notice.title} trailing={<Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} />} />
            ))}
          </Card>
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
  overviewRow: { flexDirection: 'row', gap: espaco.md },
  overviewRowCompact: { flexDirection: 'column' },
  overviewCard: { flex: 1, gap: espaco.md },
  overviewHeader: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, justifyContent: 'space-between' },
  overviewTitle: { ...tipografia.corpoForte, color: cores.texto.primario },
  overviewValue: { ...tipografia.titulo, color: cores.texto.primario },
  overviewDescription: { ...tipografia.legenda, color: cores.texto.discreto },
  reviewAction: { alignSelf: 'flex-start', marginLeft: -espaco.lg },
  attentionIndicator: { alignItems: 'center', borderRadius: raio.pill, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  attentionIndicatorUrgent: { backgroundColor: cores.status.erro.superficie },
  attentionIndicatorImportant: { backgroundColor: cores.status.pendente.superficie },
  dualColumns: { flexDirection: 'row', gap: espaco.xl },
  dualColumnsCompact: { flexDirection: 'column' },
  dualColumn: { flex: 1 },
  listCard: { overflow: 'hidden' },
  eventIcon: { alignItems: 'center', backgroundColor: cores.status.informacao.superficie, borderRadius: raio.controle, height: tamanho.avatarMedio, justifyContent: 'center', width: tamanho.avatarMedio },
  insightActions: { alignItems: 'center', flexDirection: 'row', gap: espaco.micro },
  insightContent: { overflow: 'hidden' },
  insightLoading: { gap: espaco.sm, padding: espaco.lg },
  insightMarker: { borderRadius: raio.pill, height: tamanho.indicador, width: tamanho.indicador },
});
