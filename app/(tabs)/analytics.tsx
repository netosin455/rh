// ============================================================
// app/(tabs)/analytics.tsx — People Analytics
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { rotaEquipe, rotaFerias } from '../../helpers/filtros';
import { NIVEIS_RISCO, NivelRisco, ROTULO_RISCO, lerFiltroRisco, motivosParaNivel, tituloDaLista } from '../../helpers/risco';

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
  // O filtro de risco mora na URL (?risco=medio): voltar do perfil, deep link e recarregar mantêm a lista.
  const params = useLocalSearchParams<{ risco?: string | string[] }>();
  const filtroRisco = lerFiltroRisco(params.risco);
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

  // Clicar no card seleciona; clicar de novo no mesmo (ou em "Ver todos") limpa.
  const selecionarRisco = useCallback((nivel: NivelRisco | null) => {
    router.setParams({ risco: nivel ?? undefined });
  }, [router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingContent}><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /></View>
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

  // Sem filtro: alto + médio (como antes). Com filtro: SÓ o nível escolhido, completo.
  const linhasRisco: { employee: EmployeeAtRisk; nivel: NivelRisco }[] = filtroRisco
    ? turnover_risk[filtroRisco].employees.map((employee) => ({ employee, nivel: filtroRisco }))
    : [
        ...turnover_risk.alto.employees.map((employee) => ({ employee, nivel: 'alto' as const })),
        ...turnover_risk.medio.employees.map((employee) => ({ employee, nivel: 'medio' as const })),
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
      <Section title="Visão geral"><View style={styles.metricGrid}><MetricCard accessibilityLabel={`Total: ${summary.total}. Abrir a equipe.`} detail="No sistema" label="Total" onPress={() => router.push(rotaEquipe() as never)} value={summary.total} /><MetricCard accessibilityLabel={`Ativos: ${summary.ativo}. Ver quem está ativo na equipe.`} onPress={() => router.push(rotaEquipe('ativo') as never)} label="Ativos" value={summary.ativo} detail="Em atividade" indicator={<StatusPill label="Ativo" status="ativo" />} /><MetricCard accessibilityLabel={`Em férias: ${summary.ferias}. Ver quem está de férias na equipe.`} onPress={() => router.push(rotaEquipe('ferias') as never)} label="Em férias" value={summary.ferias} detail="Ausências programadas" indicator={<StatusPill label="Férias" status="info" />} /><MetricCard accessibilityLabel={`Em licença: ${summary.licenca + summary.afastado}. Ver licenças e afastados na equipe.`} onPress={() => router.push(rotaEquipe('licenca_afastado') as never)} label="Em licença" value={summary.licenca + summary.afastado} detail="Licenças e afastamentos" indicator={<StatusPill label="Atenção" status="pendente" />} /></View></Section>

      <Section title="Distribuição de status" description="Colaboradores ativos no sistema."><Card padded={false}>{(['ativo', 'ferias', 'licenca', 'afastado', 'desligado'] as const).map((status) => <ListRow key={status} title={STATUS_LABELS[status]} description={`${summary[status]} colaborador${summary[status] === 1 ? '' : 'es'}`} trailing={<StatusPill label={STATUS_LABELS[status]} status={statusPill[status]} />} onPress={() => router.push(rotaEquipe(status) as never)} accessibilityLabel={`${STATUS_LABELS[status]}: ${summary[status]}. Ver na equipe.`} />)}</Card></Section>

      <Section title="Headcount por departamento" description="Colaboradores ativos."><Card>{headcount_by_dept.map((department: DeptHeadcount) => <View key={department.department} style={styles.progressItem}><View style={styles.progressHeader}><Text style={styles.progressLabel} numberOfLines={1}>{department.department}</Text><Text style={styles.progressValue}>{department.count}</Text></View><ProgressBar value={maxDept > 0 ? Math.round((department.count / maxDept) * 100) : 0} tone="info" accessibilityLabel={`${department.department}: ${department.count} colaboradores`} /></View>)}</Card></Section>

      <Section title="Absenteísmo" description="Dias de ausência aprovados."><View style={styles.metricGrid}><MetricCard accessibilityLabel={`Absenteísmo do mês atual: ${absenteeism.current.pct.toFixed(1)}%. Abrir as ausências.`} onPress={() => router.push(rotaFerias() as never)} label="Mês atual" value={`${absenteeism.current.pct.toFixed(1)}%`} detail={pluralDias(absenteeism.current.days)} indicator={<StatusPill label={absTrend > 0 ? 'Subiu' : absTrend < 0 ? 'Caiu' : 'Estável'} status={absTrend > 0 ? 'erro' : absTrend < 0 ? 'ativo' : 'inativo'} />} /><MetricCard label="Mês anterior" value={`${absenteeism.prev.pct.toFixed(1)}%`} detail={pluralDias(absenteeism.prev.days)} /></View><Text style={styles.note}>Base: 22 dias úteis × colaboradores ativos.</Text></Section>

      {/* Clima Organizacional */}
      {climate_history.length > 0 && (
        <Section title="Clima organizacional" description="Média das pesquisas de pulso — últimos seis meses." action={<Button accessibilityLabel="Ver pesquisas de pulso" label="Ver pesquisas" onPress={() => router.push('/pesquisas' as never)} variant="ghost" />}><Card>{climate_history.map((climate: ClimateHistory) => <View key={climate.month} style={styles.progressItem}><View style={styles.progressHeader}><Text style={styles.progressLabel}>{formatMonth(climate.month)}</Text><Text style={styles.progressValue}>{climate.avg_score.toFixed(1)}/5 · {climate.response_count} respostas</Text></View><ProgressBar value={Math.round((climate.avg_score / 5) * 100)} tone={climateTone(climate.avg_score)} accessibilityLabel={`${formatMonth(climate.month)}: ${climate.avg_score.toFixed(1)} de 5`} /></View>)}</Card></Section>
      )}

      <Section title="Risco de turnover" description="Últimos 90 dias e engajamento. Toque em um card para ver só aquele nível.">
        <View accessibilityRole="toolbar" style={styles.metricGrid}>
          {NIVEIS_RISCO.map((risk) => (
            <MetricCard
              accessibilityLabel={`Risco ${ROTULO_RISCO[risk].toLowerCase()}: ${turnover_risk[risk].count} colaborador${turnover_risk[risk].count === 1 ? '' : 'es'}. ${filtroRisco === risk ? 'Filtro ativo. Toque para limpar.' : 'Toque para ver a lista.'}`}
              detail="Colaboradores"
              indicator={<StatusPill label={ROTULO_RISCO[risk]} status={riskPill[risk]} />}
              key={risk}
              label={`Risco ${ROTULO_RISCO[risk].toLowerCase()}`}
              onPress={() => selecionarRisco(filtroRisco === risk ? null : risk)}
              selecionado={filtroRisco === risk}
              value={turnover_risk[risk].count}
            />
          ))}
        </View>
        <View style={styles.listaCabecalho}>
          <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.listaTitulo}>
            {filtroRisco ? tituloDaLista(filtroRisco, turnover_risk[filtroRisco].employees.length) : 'Em atenção (risco alto e médio)'}
          </Text>
          {filtroRisco ? <Button accessibilityLabel="Ver todos os níveis de risco" label="Ver todos" onPress={() => selecionarRisco(null)} variant="ghost" /> : null}
        </View>
        {linhasRisco.length > 0 ? (
          <Card padded={false}>
            {linhasRisco.map(({ employee, nivel }) => {
              const motivos = motivosParaNivel(employee, nivel);
              return (
                <ListRow
                  accessibilityLabel={`Ver detalhes de ${employee.name}, risco ${ROTULO_RISCO[nivel].toLowerCase()}. ${motivos.join('. ')}`}
                  description={`${employee.department_name ?? 'Sem departamento'} · ${motivos.join(' · ')}`}
                  key={employee.id}
                  leading={<Avatar name={employee.name} size="small" />}
                  onPress={() => router.push(`/colaborador/${employee.id}` as never)}
                  title={employee.name}
                  trailing={<StatusPill label={ROTULO_RISCO[nivel]} status={riskPill[nivel]} />}
                />
              );
            })}
          </Card>
        ) : (
          <Card><EmptyState icon="shield-checkmark-outline" title={filtroRisco ? `Ninguém com risco ${ROTULO_RISCO[filtroRisco].toLowerCase()}` : 'Nenhum risco elevado'} description={filtroRisco ? 'Não há colaboradores neste nível nesta leitura.' : 'Não há colaboradores em atenção nesta leitura.'} /></Card>
        )}
      </Section>

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
  listaCabecalho: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  listaTitulo: { ...tipografia.corpoForte, color: cores.texto.primario, flex: 1 },
  note: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'center' },
  urgentIcon: { alignItems: 'center', backgroundColor: cores.status.erro.superficie, borderRadius: tamanho.avatarPequeno, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  actionIcon: { alignItems: 'center', backgroundColor: cores.superficie.sutil, borderRadius: tamanho.avatarPequeno, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
});
