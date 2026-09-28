// ============================================================
// app/(tabs)/analytics.tsx — People Analytics
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAnalyticsOverview } from '../../conexoes/analytics';
import {
  AnalyticsOverview, EmployeeAtRisk, DeptHeadcount, ClimateHistory,
} from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { STATUS_LABELS } from '../../tipos/modelos';
import { exportAnalyticsPDF } from '../../helpers/pdf';
import { Avatar } from '../../componentes/Avatar';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { ProgressBar } from '../../componentes/ProgressBar';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { espaco, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

// ── Helpers ──────────────────────────────────────────────────

const statusPill: Record<string, 'ativo' | 'info' | 'pendente' | 'inativo'> = {
  ativo: 'ativo',
  ferias: 'info',
  licenca: 'pendente',
  afastado: 'pendente',
  desligado: 'inativo',
};

const riskPill: Record<string, 'danger' | 'pending' | 'success'> = {
  alto: 'danger',
  medio: 'pending',
  baixo: 'success',
};

const RISK_LABELS: Record<string, string> = {
  alto:  'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

function pluralDias(n: number) {
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

function climateTone(avg: number): 'success' | 'accent' | 'danger' {
  if (avg >= 3.5) return 'success';
  if (avg >= 2.5) return 'accent';
  return 'danger';
}

function formatMonth(yyyymm: string): string {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [, m] = yyyymm.split('-');
  return months[parseInt(m, 10) - 1] ?? yyyymm;
}

// ── Tela principal ────────────────────────────────────────────

export default function AnalyticsScreen() {
  const router = useRouter();
  const [data,       setData]       = useState<AnalyticsOverview | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const overview = await getAnalyticsOverview();
      setData(overview);
    } catch (e: unknown) {
      const er = e as { message?: string };
      setLoadError(er?.message ?? 'Erro ao carregar analytics');
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingContent}><Skeleton height={tamanho.tela} /><Skeleton height={tamanho.tela} /><Skeleton height={tamanho.tela} /></View>
      </View>
    );
  }

  if (loadError || !data) {
    return (
      <View style={styles.centered}>
        <Card><EmptyState icon="warning-outline" title="Não foi possível carregar analytics" description={loadError ?? 'Sem dados disponíveis'} action={<Button label="Tentar novamente" icon="refresh-outline" variant="secondary" onPress={load} />} /></Card>
      </View>
    );
  }

  const { summary, headcount_by_dept, absenteeism, turnover_risk, urgent_cases, climate_history } = data;

  const maxDept = Math.max(...headcount_by_dept.map((d: DeptHeadcount) => d.count), 1);

  const atRiskList: EmployeeAtRisk[] = [
    ...turnover_risk.alto.employees,
    ...turnover_risk.medio.employees,
  ].slice(0, 8);

  const absTrend = absenteeism.current.pct - absenteeism.prev.pct;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />
      }
    >
      <ScreenHeader title="People Analytics" subtitle="Indicadores para decisões de pessoas." action={<Button label="Exportar PDF" icon="download-outline" variant="ghost" onPress={() => exportAnalyticsPDF(data)} />} />
      <Section title="Visão geral"><View style={styles.metricGrid}><MetricCard label="Total" value={summary.total} detail="No sistema" /><MetricCard label="Ativos" value={summary.ativo} detail="Em atividade" indicator={<StatusPill label="Ativo" status="ativo" />} /><MetricCard label="Em férias" value={summary.ferias} detail="Ausências programadas" indicator={<StatusPill label="Férias" status="info" />} /><MetricCard label="Em licença" value={summary.licenca + summary.afastado} detail="Licenças e afastamentos" indicator={<StatusPill label="Atenção" status="pendente" />} /></View></Section>

      <Section title="Distribuição de status" description="Colaboradores ativos no sistema."><Card padded={false}>{(['ativo', 'ferias', 'licenca', 'afastado', 'desligado'] as const).map((status) => <ListRow key={status} title={STATUS_LABELS[status]} description={`${summary[status]} colaborador${summary[status] === 1 ? '' : 'es'}`} trailing={<StatusPill label={STATUS_LABELS[status]} status={statusPill[status]} />} />)}</Card></Section>

      <Section title="Headcount por departamento" description="Colaboradores ativos."><Card>{headcount_by_dept.map((department: DeptHeadcount) => <View key={department.department} style={styles.progressItem}><View style={styles.progressHeader}><Text style={styles.progressLabel} numberOfLines={1}>{department.department}</Text><Text style={styles.progressValue}>{department.count}</Text></View><ProgressBar value={maxDept > 0 ? Math.round((department.count / maxDept) * 100) : 0} tone="info" accessibilityLabel={`${department.department}: ${department.count} colaboradores`} /></View>)}</Card></Section>

      <Section title="Absenteísmo" description="Dias de ausência aprovados."><View style={styles.metricGrid}><MetricCard label="Mês atual" value={`${absenteeism.current.pct.toFixed(1)}%`} detail={pluralDias(absenteeism.current.days)} indicator={<StatusPill label={absTrend > 0 ? 'Subiu' : absTrend < 0 ? 'Caiu' : 'Estável'} status={absTrend > 0 ? 'erro' : absTrend < 0 ? 'ativo' : 'inativo'} />} /><MetricCard label="Mês anterior" value={`${absenteeism.prev.pct.toFixed(1)}%`} detail={pluralDias(absenteeism.prev.days)} /></View><Text style={styles.note}>Base: 22 dias úteis × colaboradores ativos.</Text></Section>

      {/* Clima Organizacional */}
      {climate_history.length > 0 && (
        <Section title="Clima organizacional" description="Média das pesquisas de pulso — últimos seis meses."><Card>{climate_history.map((climate: ClimateHistory) => <View key={climate.month} style={styles.progressItem}><View style={styles.progressHeader}><Text style={styles.progressLabel}>{formatMonth(climate.month)}</Text><Text style={styles.progressValue}>{climate.avg_score.toFixed(1)}/5 · {climate.response_count} respostas</Text></View><ProgressBar value={Math.round((climate.avg_score / 5) * 100)} tone={climateTone(climate.avg_score)} accessibilityLabel={`${formatMonth(climate.month)}: ${climate.avg_score.toFixed(1)} de 5`} /></View>)}</Card></Section>
      )}

      <Section title="Risco de turnover" description="Últimos 90 dias e engajamento."><View style={styles.metricGrid}>{(['alto', 'medio', 'baixo'] as const).map((risk) => <MetricCard key={risk} label={`Risco ${RISK_LABELS[risk].toLowerCase()}`} value={turnover_risk[risk].count} detail="Colaboradores" indicator={<StatusPill label={RISK_LABELS[risk]} status={riskPill[risk]} />} />)}</View>{atRiskList.length > 0 ? <Card padded={false}>{atRiskList.map((employee: EmployeeAtRisk) => { const risk = turnover_risk.alto.employees.some((item: EmployeeAtRisk) => item.id === employee.id) ? 'alto' : 'medio'; return <ListRow key={employee.id} title={employee.name} description={`${employee.department_name ?? 'Sem departamento'} · ${pluralDias(employee.days_in_company)} de empresa${employee.avg_pulse_score != null ? ` · Pulso: ${employee.avg_pulse_score.toFixed(1)}/5` : ''}`} leading={<Avatar name={employee.name} size="small" />} trailing={<StatusPill label={RISK_LABELS[risk]} status={riskPill[risk]} />} onPress={() => router.push(`/colaborador/${employee.id}` as never)} accessibilityLabel={`Ver detalhes de ${employee.name}, risco ${RISK_LABELS[risk]}`} />; })}</Card> : <Card><EmptyState icon="shield-checkmark-outline" title="Nenhum risco elevado" description="Não há colaboradores em atenção nesta leitura." /></Card>}</Section>

      {/* Processos Urgentes */}
      {urgent_cases.length > 0 && (
        <Section title="Processos urgentes" description={`${urgent_cases.length} caso${urgent_cases.length === 1 ? '' : 's'} com prazo próximo.`}><Card padded={false}>{urgent_cases.map((caseItem) => <ListRow key={caseItem.id} title={caseItem.title} description={`${caseItem.case_number}${caseItem.responsible_name ? ` · ${caseItem.responsible_name}` : ''}${caseItem.deadline ? ` · Prazo: ${new Date(caseItem.deadline).toLocaleDateString('pt-BR')}` : ''}`} leading={<View style={styles.urgentIcon}><Ionicons name="alert-circle-outline" size={tamanho.iconeMedio} color={cores.status.erro.forte} /></View>} trailing={<StatusPill label="Urgente" status="erro" />} />)}</Card></Section>
      )}

      <Section title="Próximas ações"><Card padded={false}><ListRow title="Onboarding digital" description="Acompanhar checklists e progresso." leading={<View style={styles.actionIcon}><Ionicons name="rocket-outline" size={tamanho.iconeMedio} color={cores.status.informacao.forte} /></View>} trailing={<Ionicons name="chevron-forward" size={tamanho.iconeMedio} color={cores.texto.discreto} />} onPress={() => router.push('/onboarding' as never)} accessibilityLabel="Ver onboardings ativos" /><ListRow title="Pesquisas de pulso" description="Criar, compartilhar e ver resultados." leading={<View style={styles.actionIcon}><Ionicons name="clipboard-outline" size={tamanho.iconeMedio} color={cores.accent.douradoProfundo} /></View>} trailing={<Ionicons name="chevron-forward" size={tamanho.iconeMedio} color={cores.texto.discreto} />} onPress={() => router.push('/pesquisas' as never)} accessibilityLabel="Gerenciar pesquisas" /></Card></Section>
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  centered: { alignItems: 'center', backgroundColor: cores.superficie.pagina, flex: 1, justifyContent: 'center', padding: espaco.xl },
  loadingContent: { gap: espaco.lg, width: '100%' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  progressItem: { gap: espaco.xs, marginBottom: espaco.lg },
  progressHeader: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  progressLabel: { ...tipografia.corpoForte, color: cores.texto.primario, flex: 1 },
  progressValue: { ...tipografia.legenda, color: cores.texto.secundario },
  note: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'center' },
  urgentIcon: { alignItems: 'center', backgroundColor: cores.status.erro.superficie, borderRadius: tamanho.avatarPequeno, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  actionIcon: { alignItems: 'center', backgroundColor: cores.superficie.sutil, borderRadius: tamanho.avatarPequeno, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
});
