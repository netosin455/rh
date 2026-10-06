import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Revelar } from '../../componentes/Revelar';
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
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { AvisoDesatualizado } from '../../componentes/AvisoDesatualizado';
import { EntradaItem } from '../../componentes/EntradaItem';
import { usarRevelacao } from '../../contextos/usarRevelacao';
import { usarDados } from '../../contextos/usarDados';
import { chaves } from '../../helpers/chavesCache';
import { gravarCache } from '../../helpers/cacheDados';
import { useAuth } from '../../contextos/Autenticacao';
import { cores } from '../../estilo/cores';
import { rotaEquipe, rotaFerias } from '../../helpers/filtros';
import { iconeDoAlerta } from '../../helpers/alertas';
import { rotaDoAlerta } from '../../helpers/risco';
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
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canSeeInsights = INSIGHT_ROLES.includes(user?.role ?? '');
  const podeAprovar = APPROVER_ROLES.includes(user?.role ?? '');
  const logado = Boolean(user);
  const mesAtual = getTodayString().slice(0, 7);

  // Cada bloco vem do cache: voltar ao Dashboard mostra tudo na hora e atualiza por baixo. Sem cache, esqueleto como antes.
  const colaboradores = usarDados(chaves.colaboradores, () => getEmployees(), { ativo: logado });
  const proximosEventos = usarDados(chaves.proximosEventos(5), () => getUpcomingEvents(5), { ativo: logado });
  const avisos = usarDados(chaves.avisos, () => getNotices(), { ativo: logado });
  const alertasApi = usarDados(chaves.alertas, () => getAlerts(), { ativo: logado });
  const faltasDoMes = usarDados(chaves.contagemFaltas(mesAtual), () => countAbsences('falta', mesAtual), { ativo: logado });
  const pendentes = usarDados(chaves.contagemPendentes, () => countPendentes(), { ativo: logado && podeAprovar });
  const resumoIA = usarDados(chaves.insights, () => buscarInsights(false), { ativo: logado && canSeeInsights });
  // "Atualizar" da IA pede ao servidor um resumo novo (refresh=1) e grava no cache.
  const [insightsForcando, setInsightsForcando] = useState(false);
  const [insightsErroForcado, setInsightsErroForcado] = useState(false);

  const employees: Employee[] = colaboradores.dados ?? [];
  const events: Event[] = proximosEventos.dados ?? [];
  const notices: Notice[] = avisos.dados ?? [];
  const alerts: ProactiveAlert[] = alertasApi.dados ?? [];
  const faltaCount = faltasDoMes.dados ?? 0;
  const pendentesCount = pendentes.dados ?? 0;
  const insights: Insight[] = resumoIA.dados?.insights ?? [];
  const insightsLoading = resumoIA.carregando || insightsForcando;
  const insightsErro = insightsErroForcado || (resumoIA.erro !== null && resumoIA.dados === undefined);
  const loading = colaboradores.carregando || proximosEventos.carregando || avisos.carregando;
  // Seções entram escalonadas SÓ quando vêm do esqueleto; com cache aparecem no 1º frame.
  const modo = usarRevelacao(loading, colaboradores.dados !== undefined);
  const blocos: [string, { erro: Error | null; dados: unknown }][] = [
    ['colaboradores', colaboradores], ['agenda', proximosEventos], ['avisos', avisos], ['alertas', alertasApi],
    ['faltas do mês', faltasDoMes], ['férias pendentes', pendentes],
  ];
  // Bloco que falhou SEM nada para mostrar: avisa (falha de API não pode parecer "nenhum dado").
  const falhas = blocos.filter(([, b]) => b.erro !== null && b.dados === undefined).map(([nome]) => nome);
  const algumErroLeve = [colaboradores, proximosEventos, avisos, alertasApi, faltasDoMes, pendentes].some((b) => b.erroLeve);

  const carregarInsights = useCallback(async (forcar = false) => {
    if (!forcar) { await resumoIA.recarregar(); return; }
    setInsightsForcando(true);
    setInsightsErroForcado(false);
    try {
      gravarCache(chaves.insights, await buscarInsights(true));
    } catch (error) {
      console.error('[Dashboard] Falha ao atualizar insights:', error);
      setInsightsErroForcado(true);
    } finally {
      setInsightsForcando(false);
    }
  }, [resumoIA.recarregar]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      colaboradores.recarregar(), proximosEventos.recarregar(), avisos.recarregar(), alertasApi.recarregar(), faltasDoMes.recarregar(),
      podeAprovar ? pendentes.recarregar() : Promise.resolve(),
      canSeeInsights ? resumoIA.recarregar() : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [colaboradores.recarregar, proximosEventos.recarregar, avisos.recarregar, alertasApi.recarregar, faltasDoMes.recarregar, pendentes.recarregar, resumoIA.recarregar, podeAprovar, canSeeInsights]);

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
      title: alert.title || 'Alerta',
      description: alert.description ?? 'Este alerta requer revisão.',
      icon: iconeDoAlerta(alert, Ionicons.glyphMap) as keyof typeof Ionicons.glyphMap,
      level: 'urgent' as const,
      // Risco de saída vai direto para a lista filtrada em /analytics?risco=alto.
      route: rotaDoAlerta(alert),
    })),
    ...(canSeeInsights && pendentesCount > 0 ? [{
      id: 'pending-vacations',
      title: `${pendentesCount} solicitação${pendentesCount === 1 ? '' : 'ões'} de férias pendente${pendentesCount === 1 ? '' : 's'}`,
      description: 'Revise os pedidos da equipe.',
      icon: 'time-outline' as const,
      level: 'important' as const,
      route: rotaFerias(),
    }] : []),
    ...(faltaCount > 0 ? [{
      id: 'monthly-absences',
      title: `${faltaCount} falta${faltaCount === 1 ? '' : 's'} registrada${faltaCount === 1 ? '' : 's'} no mês`,
      description: 'Consulte as ausências para acompanhar a equipe.',
      icon: 'alert-circle-outline' as const,
      level: 'important' as const,
      route: rotaFerias('falta'),
    }] : []),
    ...alerts.filter((alert) => alert.severity !== 'alta').map((alert, index) => ({
      id: `important-alert-${index}`,
      title: alert.title || 'Alerta',
      description: alert.description ?? 'Há um item para acompanhar.',
      icon: iconeDoAlerta(alert, Ionicons.glyphMap) as keyof typeof Ionicons.glyphMap,
      level: 'important' as const,
      route: rotaDoAlerta(alert),
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

  const esqueleto = (
    <DashboardLoading />
  );

  const principal = (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={cores.accent.dourado} />}
      style={styles.screen}
    >
      <ScreenHeader
        title={`Olá, ${user?.name?.split(' ')[0] || 'Usuário'}`}
        subtitle={`${todayName} · ${formatDateDisplay(today)}`}
      />

      <AvisoDesatualizado visivel={algumErroLeve} />
      {falhas.length > 0 ? (
        <ErroComRetry
          mensagem={`Não foi possível carregar: ${falhas.join(', ')}. Os números abaixo podem estar incompletos.`}
          onTentarNovamente={onRefresh}
          carregando={refreshing}
        />
      ) : null}

      <EntradaItem indice={0} modo={modo} saida={false} total={4}>
      <View style={[styles.overviewRow, compact && styles.overviewRowCompact]}>
        <Card accessibilityLabel={`Equipe hoje: ${activeEmployees} de ${employees.length} disponíveis. Ver quem está disponível.`} onPress={() => router.navigate(rotaEquipe('ativo') as never)} style={styles.overviewCard}>
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
      </EntradaItem>

      {attentionItems.length > 0 ? (
        <EntradaItem indice={1} modo={modo} saida={false} total={4}>
        <Section title="Precisa de atenção">
          <Card padded={false} style={styles.listCard}>
            {attentionItems.map((item) => {
              const urgent = item.level === 'urgent';
              return <ListRow accessibilityLabel={`${item.title}. ${item.description}`} description={item.description} key={item.id} leading={<View style={[styles.attentionIndicator, urgent ? styles.attentionIndicatorUrgent : styles.attentionIndicatorImportant]}><Ionicons color={urgent ? cores.status.erro.forte : cores.status.pendente.forte} name={item.icon} size={tamanho.iconePequeno} /></View>} onPress={() => router.navigate(item.route as never)} title={item.title} trailing={<Ionicons color={cores.texto.discreto} name="chevron-forward" size={tamanho.iconePequeno} />} />;
            })}
          </Card>
        </Section>
        </EntradaItem>
      ) : null}

      <EntradaItem indice={2} modo={modo} saida={false} total={4}>
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
                <ListRow accessibilityLabel={`Abrir perfil de ${employee.name}, aniversário ${employee.birthdayLabel}`} description={employee.birthdayLabel} key={employee.id} leading={<Avatar name={employee.name} />} onPress={() => router.navigate(`/colaborador/${employee.id}` as never)} title={employee.name} />
              ))}
            </Card>
          </Section>
        </View>
      </View>
      </EntradaItem>

      <EntradaItem indice={3} modo={modo} saida={false} total={4}>
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
      </EntradaItem>

      {canSeeInsights && (insightsLoading || insightsErro || insights.length > 0) ? (
        <Section
          action={
            <View style={styles.insightActions}>
              <Button accessibilityLabel={insightsExpanded ? 'Ocultar insights da IA' : 'Mostrar insights da IA'} label={insightsExpanded ? 'Ocultar' : 'Mostrar'} onPress={() => setInsightsExpanded((expanded) => !expanded)} variant="ghost" />
              <Button accessibilityLabel="Atualizar insights da IA" icon="refresh" onPress={() => { void carregarInsights(true); }} variant="ghost" />
            </View>
          }
          title="Insights"
        >
          {insightsErro && !insightsLoading ? (
            <ErroComRetry mensagem="Não foi possível carregar os insights." onTentarNovamente={() => { void carregarInsights(true); }} />
          ) : null}
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
  return (
    <Revelar carregando={loading} esqueleto={esqueleto}>
      {principal}
    </Revelar>
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
