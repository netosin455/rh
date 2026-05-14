// ============================================================
// app/(tabs)/analytics.tsx — People Analytics
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAnalyticsOverview } from '../../conexoes/analytics';
import { AnalyticsOverview, EmployeeAtRisk, DeptHeadcount } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { STATUS_LABELS } from '../../tipos/modelos';

// ── Helpers ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ativo:    theme.success,
  ferias:   theme.info,
  licenca:  theme.warning,
  afastado: '#FB923C',
  desligado: theme.textMuted,
};

const RISK_COLORS: Record<string, string> = {
  alto:  theme.danger,
  medio: theme.warning,
  baixo: theme.success,
};

const RISK_LABELS: Record<string, string> = {
  alto:  'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

const AREA_LABELS: Record<string, string> = {
  civel:       'Cível',
  trabalhista: 'Trabalhista',
  tributario:  'Tributário',
  familia:     'Família',
  criminal:    'Criminal',
  empresarial: 'Empresarial',
  outro:       'Outro',
};

function pluralDias(n: number) {
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

// ── Sub-componentes ───────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionAccent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function KPICard({ label, value, color, icon, delay }: {
  label: string; value: number; color: string; icon: string; delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as any} size={15} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Animated.View>
  );
}

function HorizontalBar({ label, value, max, color }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const barColor = color ?? theme.gold;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.barCount, { color: barColor }]}>{value}</Text>
    </View>
  );
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
    } catch (e: any) {
      setLoadError(e?.message ?? 'Erro ao carregar analytics');
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
        <ActivityIndicator color={theme.gold} size="large" />
        <Text style={styles.loadingText}>Carregando analytics…</Text>
      </View>
    );
  }

  if (loadError || !data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="bar-chart-outline" size={40} color={theme.textMuted} />
        <Text style={styles.errorText}>{loadError ?? 'Sem dados disponíveis'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { summary, headcount_by_dept, absenteeism, turnover_risk, urgent_cases } = data;

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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
      }
    >
      {/* KPI Grid */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.kpiGrid}>
        <KPICard label="Total"       value={summary.total}    color={theme.gold}    icon="people"    delay={0}   />
        <KPICard label="Ativos"      value={summary.ativo}    color={theme.success} icon="checkmark-circle" delay={60}  />
        <KPICard label="Em Férias"   value={summary.ferias}   color={theme.info}    icon="umbrella"  delay={120} />
        <KPICard label="Em Licença"  value={summary.licenca + summary.afastado}
                                                               color={theme.warning} icon="medical"   delay={180} />
      </Animated.View>

      {/* Distribuição de Status */}
      <Animated.View entering={FadeInDown.delay(220).duration(350)} style={styles.card}>
        <SectionHeader title="Distribuição de Status" subtitle="Colaboradores ativos no sistema" />
        <View style={styles.cardBody}>
          {/* Stacked bar */}
          <View style={styles.stackedBar}>
            {(['ativo','ferias','licenca','afastado'] as const).map(s => {
              const count = summary[s];
              const active = summary.total - summary.desligado;
              const pct = active > 0 ? (count / active) * 100 : 0;
              if (pct < 1) return null;
              return (
                <View
                  key={s}
                  style={[styles.stackedSegment, { flex: pct, backgroundColor: STATUS_COLORS[s] }]}
                />
              );
            })}
          </View>
          {/* Legenda */}
          <View style={styles.legendRow}>
            {(['ativo','ferias','licenca','afastado','desligado'] as const).map(s => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[s] }]} />
                <Text style={styles.legendLabel}>{STATUS_LABELS[s]}</Text>
                <Text style={[styles.legendCount, { color: STATUS_COLORS[s] }]}>{summary[s]}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Headcount por Departamento */}
      <Animated.View entering={FadeInDown.delay(280).duration(350)} style={styles.card}>
        <SectionHeader title="Headcount por Departamento" subtitle="Colaboradores ativos" />
        <View style={styles.cardBody}>
          {headcount_by_dept.map((dept: DeptHeadcount, i: number) => (
            <HorizontalBar
              key={dept.department}
              label={dept.department}
              value={dept.count}
              max={maxDept}
              color={i === 0 ? theme.gold : i === 1 ? theme.info : i === 2 ? theme.success : theme.textLight}
            />
          ))}
        </View>
      </Animated.View>

      {/* Absenteísmo */}
      <Animated.View entering={FadeInDown.delay(340).duration(350)} style={styles.card}>
        <SectionHeader title="Absenteísmo" subtitle="Dias de ausência aprovados" />
        <View style={styles.cardBody}>
          <View style={styles.absentRow}>
            {/* Mês atual */}
            <View style={styles.absentBlock}>
              <Text style={styles.absentPct}>
                {absenteeism.current.pct.toFixed(1)}%
              </Text>
              <Text style={styles.absentLabel}>Mês atual</Text>
              <Text style={styles.absentDays}>{pluralDias(absenteeism.current.days)}</Text>
            </View>

            {/* Seta de tendência */}
            <View style={styles.absentTrend}>
              <Ionicons
                name={absTrend > 0 ? 'trending-up' : absTrend < 0 ? 'trending-down' : 'remove'}
                size={24}
                color={absTrend > 0 ? theme.danger : absTrend < 0 ? theme.success : theme.textMuted}
              />
              <Text style={[
                styles.absentTrendText,
                { color: absTrend > 0 ? theme.danger : absTrend < 0 ? theme.success : theme.textMuted },
              ]}>
                {absTrend > 0 ? `+${absTrend.toFixed(1)}%` : absTrend < 0 ? `${absTrend.toFixed(1)}%` : 'Igual'}
              </Text>
            </View>

            {/* Mês anterior */}
            <View style={[styles.absentBlock, { opacity: 0.6 }]}>
              <Text style={[styles.absentPct, { color: theme.textLight }]}>
                {absenteeism.prev.pct.toFixed(1)}%
              </Text>
              <Text style={styles.absentLabel}>Mês anterior</Text>
              <Text style={styles.absentDays}>{pluralDias(absenteeism.prev.days)}</Text>
            </View>
          </View>

          <Text style={styles.absentNote}>
            Base: 22 dias úteis × colaboradores ativos
          </Text>
        </View>
      </Animated.View>

      {/* Risco de Turnover */}
      <Animated.View entering={FadeInDown.delay(400).duration(350)} style={styles.card}>
        <SectionHeader title="Risco de Turnover" subtitle="Últimos 90 dias" />
        <View style={styles.cardBody}>
          {/* Gauges */}
          <View style={styles.riskGaugeRow}>
            {(['alto','medio','baixo'] as const).map(r => (
              <View key={r} style={styles.riskGauge}>
                <View style={[styles.riskGaugeBadge, { backgroundColor: `${RISK_COLORS[r]}18`, borderColor: `${RISK_COLORS[r]}44` }]}>
                  <Text style={[styles.riskGaugeCount, { color: RISK_COLORS[r] }]}>
                    {turnover_risk[r].count}
                  </Text>
                </View>
                <Text style={[styles.riskGaugeLabel, { color: RISK_COLORS[r] }]}>{RISK_LABELS[r]}</Text>
              </View>
            ))}
          </View>

          {/* Lista em risco */}
          {atRiskList.length > 0 ? (
            <>
              <View style={styles.riskListHeader}>
                <Text style={styles.riskListTitle}>Em atenção</Text>
              </View>
              {atRiskList.map((emp: EmployeeAtRisk) => {
                const risk = turnover_risk.alto.employees.some((e: EmployeeAtRisk) => e.id === emp.id)
                  ? 'alto' : 'medio';
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={styles.riskRow}
                    onPress={() => router.push(`/colaborador/${emp.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.riskDot, { backgroundColor: RISK_COLORS[risk] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.riskName}>{emp.name}</Text>
                      <Text style={styles.riskMeta}>
                        {emp.department_name ?? 'Sem depto'} · {pluralDias(emp.days_in_company)} de empresa
                      </Text>
                    </View>
                    <View style={[styles.riskPill, { backgroundColor: `${RISK_COLORS[risk]}18` }]}>
                      <Text style={[styles.riskPillText, { color: RISK_COLORS[risk] }]}>
                        {RISK_LABELS[risk]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyRisk}>
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.success} />
              <Text style={styles.emptyRiskText}>Nenhum colaborador em risco elevado</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Processos Urgentes */}
      {urgent_cases.length > 0 && (
        <Animated.View entering={FadeInDown.delay(460).duration(350)} style={styles.card}>
          <SectionHeader title="Processos Urgentes" subtitle={`${urgent_cases.length} caso${urgent_cases.length > 1 ? 's' : ''} com prazo próximo`} />
          <View>
            {urgent_cases.map((c) => (
              <View key={c.id} style={styles.caseRow}>
                <View style={[styles.caseAreaDot, { backgroundColor: theme.category[c.area as keyof typeof theme.category] ?? theme.textMuted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseName} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.caseMeta}>
                    {c.case_number}
                    {c.responsible_name ? ` · ${c.responsible_name}` : ''}
                    {c.deadline ? ` · Prazo: ${new Date(c.deadline).toLocaleDateString('pt-BR')}` : ''}
                  </Text>
                </View>
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>URGENTE</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, gap: 12 },
  loadingText: { color: theme.textMuted, fontSize: 13, marginTop: 8 },
  errorText:   { color: theme.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:  { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.goldDim, borderRadius: 10 },
  retryText: { color: theme.gold, fontWeight: '700', fontSize: 13 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  kpiIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kpiValue:    { fontSize: 28, fontWeight: '800', color: theme.gold, marginBottom: 2 },
  kpiLabel:    { fontSize: 10, color: theme.textLight, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  // Cards
  card: {
    backgroundColor: 'rgba(24,27,33,0.92)',
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBody: { padding: 14, paddingTop: 10 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: theme.gold },
  sectionTitle:  { fontSize: 13, fontWeight: '800', color: theme.gold, letterSpacing: 0.3 },
  sectionSub:    { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  // Stacked bar
  stackedBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 14, gap: 1 },
  stackedSegment: { borderRadius: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: theme.textMuted },
  legendCount: { fontSize: 11, fontWeight: '700' },

  // Horizontal bar
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { width: 110, fontSize: 12, color: theme.text, fontWeight: '500' },
  barTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  barFill:  { height: '100%', borderRadius: 4 },
  barCount: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Absenteeism
  absentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  absentBlock: { alignItems: 'center', gap: 4 },
  absentPct:   { fontSize: 28, fontWeight: '800', color: theme.gold },
  absentLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  absentDays:  { fontSize: 11, color: theme.textLight },
  absentTrend: { alignItems: 'center', gap: 4 },
  absentTrendText: { fontSize: 12, fontWeight: '700' },
  absentNote:  { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  // Turnover
  riskGaugeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  riskGauge:    { alignItems: 'center', gap: 6 },
  riskGaugeBadge: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  riskGaugeCount: { fontSize: 24, fontWeight: '800' },
  riskGaugeLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  riskListHeader: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, marginBottom: 8 },
  riskListTitle:  { fontSize: 11, color: theme.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  riskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  riskDot:  { width: 8, height: 8, borderRadius: 4 },
  riskName: { fontSize: 13, color: theme.white, fontWeight: '600', marginBottom: 2 },
  riskMeta: { fontSize: 11, color: theme.textMuted },
  riskPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  riskPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  emptyRisk: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  emptyRiskText: { fontSize: 13, color: theme.success, fontWeight: '600' },

  // Cases
  caseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  caseAreaDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  caseName:    { fontSize: 13, color: theme.white, fontWeight: '600', marginBottom: 2 },
  caseMeta:    { fontSize: 11, color: theme.textMuted },
  urgentBadge: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
  },
  urgentBadgeText: { fontSize: 9, color: theme.danger, fontWeight: '800', letterSpacing: 0.5 },
});
