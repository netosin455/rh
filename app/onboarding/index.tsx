// ============================================================
// app/onboarding/index.tsx — Lista de processos de onboarding
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getOnboardings, deleteOnboarding } from '../../conexoes/onboarding';
import { OnboardingProcess } from '../../tipos/modelos';
import { useToast } from '../../contextos/Toast';
import { confirmAction } from '../../helpers/confirm';
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
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

function calcProgress(proc: OnboardingProcess): { done: number; total: number; pct: number } {
  const total = proc.steps_snapshot.length;
  const done  = Object.values(proc.steps_progress).filter(s => s.completed).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function progressTone(proc: OnboardingProcess, progress: number): 'accent' | 'success' | 'info' | 'danger' {
  if (proc.completed_at) return 'success';
  if (progress >= 70) return 'info';
  if (progress >= 40) return 'accent';
  return 'danger';
}

export default function OnboardingListScreen() {
  const router = useRouter();
  const toast  = useToast();
  const [processes,  setProcesses]  = useState<OnboardingProcess[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState('');
  const [showDone,   setShowDone]   = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setProcesses(await getOnboardings(false));
    } catch (error: any) {
      const message = error?.message ?? 'Não foi possível carregar';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  function handleDelete(proc: OnboardingProcess) {
    confirmAction('Cancelar onboarding', `Encerrar o onboarding de ${proc.employee_name}?`, async () => {
      try { await deleteOnboarding(proc.id); load(); }
      catch (e: any) { toast.error(e?.message ?? 'Erro ao encerrar onboarding'); }
    });
  }

  const active    = processes.filter(p => !p.completed_at);
  const completed = processes.filter(p =>  p.completed_at);
  const shown     = showDone ? processes : active;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      style={styles.container}
    >
      <ScreenHeader
        action={completed.length > 0 ? <Button label={showDone ? 'Só ativos' : 'Ver todos'} onPress={() => setShowDone((current) => !current)} variant="secondary" /> : undefined}
        subtitle={`${active.length} ativo${active.length !== 1 ? 's' : ''} · ${completed.length} concluído${completed.length !== 1 ? 's' : ''}`}
        title="Onboarding digital"
      />

      <MetricCard
        detail="Processos ainda em andamento"
        indicator={<StatusPill label="Ativos" status="ativo" />}
        label="Onboardings ativos"
        value={loading ? '—' : active.length}
      />

      <Section title={showDone ? 'Todos os processos' : 'Em andamento'} description="Abra um processo para acompanhar ou concluir suas etapas.">
        {loading ? (
          <Card padded={false} style={styles.listCard}>
            <Skeleton accessibilityLabel="Carregando onboardings" style={styles.skeleton} />
            <Skeleton accessibilityLabel="Carregando onboardings" style={styles.skeleton} />
            <Skeleton accessibilityLabel="Carregando onboardings" style={styles.skeleton} />
          </Card>
        ) : loadError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Não foi possível carregar os onboardings"
            description={loadError}
            action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title={active.length === 0 ? 'Nenhum onboarding ativo' : 'Sem processos para mostrar'}
            description="Inicie um onboarding a partir do perfil de um colaborador."
            action={<Button icon="people-outline" label="Ver colaboradores" onPress={() => router.push('/(tabs)/colaboradores' as any)} />}
          />
        ) : (
          <View style={styles.processList}>
            {shown.map((proc) => {
              const { done, total, pct } = calcProgress(proc);
              const isComplete = Boolean(proc.completed_at);
              const description = [proc.role_title, proc.department_name].filter(Boolean).join(' · ') || 'Função não informada';
              return (
                <Card key={proc.id} padded={false} style={isComplete ? styles.completedCard : undefined}>
                  <ListRow
                    description={description}
                    leading={<Avatar name={proc.employee_name ?? 'Colaborador'} />}
                    title={proc.employee_name ?? 'Colaborador'}
                    trailing={<StatusPill label={isComplete ? 'Concluído' : `${pct}% concluído`} status={isComplete ? 'ativo' : 'pendente'} />}
                  />
                  <View style={styles.cardBody}>
                    <ProgressBar accessibilityLabel={`${proc.employee_name ?? 'Colaborador'}: ${pct}% concluído`} tone={progressTone(proc, pct)} value={pct} />
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{done}/{total} etapas</Text>
                      <Text style={styles.metaText}>{isComplete ? `Concluído em ${daysSince(proc.completed_at!)}d` : `${daysSince(proc.started_at)}d em andamento`}</Text>
                      <Text style={styles.metaText}>{proc.template_name}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Button icon="arrow-forward-outline" label="Abrir" onPress={() => router.push(`/onboarding/${proc.id}` as any)} style={styles.openButton} variant="ghost" />
                    {!isComplete ? <Button accessibilityLabel={`Cancelar onboarding de ${proc.employee_name ?? 'colaborador'}`} icon="close-outline" onPress={() => handleDelete(proc)} variant="danger" /> : null}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  listCard: { overflow: 'hidden' },
  skeleton: { marginHorizontal: espaco.md, marginVertical: espaco.sm },
  processList: { gap: espaco.md },
  completedCard: { opacity: 0.7 },
  cardBody: { gap: espaco.md, padding: espaco.lg },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  metaText: { ...tipografia.legenda, color: cores.texto.discreto },
  cardActions: { borderTopColor: cores.borda.sutil, borderTopWidth: 1, flexDirection: 'row', gap: espaco.xs, padding: espaco.sm },
  openButton: { flex: 1 },
});
