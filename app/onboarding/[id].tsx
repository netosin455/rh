// ============================================================
// app/onboarding/[id].tsx — Checklist interativo de onboarding
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOnboarding, markStep, deleteOnboarding } from '../../conexoes/onboarding';
import { OnboardingProcess, OnboardingStep, StepProgress } from '../../tipos/modelos';
import { useToast } from '../../contextos/Toast';
import { confirmAction } from '../../helpers/confirm';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
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

const ROLE_LABELS: Record<string, string> = {
  rh:     'RH',
  gestor: 'Gestor',
  ti:     'TI',
  adm:    'Administrativo',
};
const ROLE_TONES: Record<string, 'gold' | 'info' | 'success' | 'muted'> = {
  rh: 'gold',
  gestor: 'info',
  ti: 'success',
  adm: 'muted',
};

function calcProgress(proc: OnboardingProcess) {
  const total = proc.steps_snapshot.length;
  const done  = Object.values(proc.steps_progress).filter(s => s.completed).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function progressTone(proc: OnboardingProcess, progress: number): 'accent' | 'success' | 'info' | 'danger' {
  if (proc.completed_at) return 'success';
  if (progress >= 70) return 'info';
  if (progress >= 40) return 'accent';
  return 'danger';
}

export default function OnboardingDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const toast   = useToast();

  const [proc,      setProc]      = useState<OnboardingProcess | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling,  setToggling]  = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return getOnboarding(Number(id))
      .then(setProc)
      .catch(e => setLoadError(e?.message ?? 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(idx: number, currentDone: boolean) {
    if (proc?.completed_at) return;
    setToggling(idx);
    try {
      const updated = await markStep(Number(id), idx, !currentDone);
      setProc(updated);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar etapa');
    } finally {
      setToggling(null);
    }
  }

  function handleCancel() {
    confirmAction('Encerrar', 'Deseja encerrar este onboarding?', async () => {
      try { await deleteOnboarding(Number(id)); router.replace('/onboarding' as any); }
      catch (e: any) { toast.error(e?.message ?? 'Erro ao encerrar onboarding'); }
    });
  }

  if (loadError || (!loading && !proc)) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="alert-circle-outline"
          title="Não foi possível carregar o onboarding"
          description={loadError ?? 'Processo não encontrado.'}
          action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />}
        />
        <Button icon="arrow-back-outline" label="Voltar para onboarding" onPress={() => router.back()} variant="ghost" />
      </View>
    );
  }

  if (loading || !proc) {
    return (
      <View style={styles.loading}>
        <Skeleton accessibilityLabel="Carregando cabeçalho do onboarding" height={espaco.tela} />
        <Skeleton accessibilityLabel="Carregando progresso do onboarding" height={espaco.gigante} />
        <Skeleton accessibilityLabel="Carregando etapas do onboarding" height={espaco.tela} />
      </View>
    );
  }

  const { done, total, pct } = calcProgress(proc);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <ScreenHeader
        action={(
          <View style={styles.headerActions}>
            <Button accessibilityLabel="Voltar para onboarding" icon="arrow-back-outline" onPress={() => router.back()} variant="ghost" />
            {!proc.completed_at ? <Button icon="close-outline" label="Encerrar" onPress={handleCancel} variant="danger" /> : null}
          </View>
        )}
        subtitle={[proc.role_title, proc.department_name].filter(Boolean).join(' · ') || 'Colaborador'}
        title={proc.employee_name ?? 'Onboarding'}
      />

      <Card>
        <View style={styles.processSummary}>
          <ListRow
            description={`Template: ${proc.template_name}`}
            leading={<Avatar name={proc.employee_name ?? 'Colaborador'} size="large" />}
            title={proc.employee_name ?? 'Colaborador'}
            trailing={<StatusPill label={proc.completed_at ? 'Concluído' : 'Em andamento'} status={proc.completed_at ? 'ativo' : 'pendente'} />}
          />
          <ProgressBar accessibilityLabel={`Progresso do onboarding: ${pct}%`} tone={progressTone(proc, pct)} value={pct} />
        </View>
      </Card>

      <View style={styles.metricsRow}>
        <View style={styles.metric}><MetricCard detail="Etapas concluídas" label="Progresso" value={`${done}/${total}`} /></View>
        <View style={styles.metric}><MetricCard detail="Data de início" label="Início" value={formatDate(proc.started_at)} /></View>
        <View style={styles.metric}><MetricCard detail="Data de encerramento" label="Conclusão" value={proc.completed_at ? formatDate(proc.completed_at) : 'Em andamento'} /></View>
      </View>

      <Section title="Etapas do checklist" description="Marque uma etapa ao concluí-la. Os prazos são contados a partir do início.">
        <View style={styles.stepList}>
          {proc.steps_snapshot.map((step: OnboardingStep, idx: number) => {
            const progress: StepProgress = proc.steps_progress[String(idx)] ?? { completed: false };
            const isDone = progress.completed;
            const isToggling = toggling === idx;
            const deadline = new Date(proc.started_at);
            deadline.setDate(deadline.getDate() + step.days_deadline);
            const isLate = !isDone && deadline < new Date() && !proc.completed_at;
            const deadlineLabel = `${isLate ? 'Atrasada' : 'Prazo'}: ${deadline.toLocaleDateString('pt-BR')}`;

            return (
              <Card key={idx} padded={false} style={isDone ? styles.completedStep : undefined}>
                <ListRow
                  description={step.description || 'Sem descrição adicional.'}
                  leading={<Badge label={String(idx + 1)} tone={isDone ? 'success' : 'muted'} />}
                  title={step.title}
                  trailing={<Badge label={ROLE_LABELS[step.responsible_role] ?? step.responsible_role} tone={ROLE_TONES[step.responsible_role] ?? 'muted'} />}
                />
                <View style={styles.stepBody}>
                  <StatusPill label={deadlineLabel} status={isLate ? 'danger' : isDone ? 'ativo' : 'muted'} />
                  {isDone && progress.completed_by ? <Text style={styles.completedBy}>Concluído por {progress.completed_by}{progress.completed_at ? ` em ${formatDate(progress.completed_at)}` : ''}.</Text> : null}
                </View>
                <View style={styles.stepActions}>
                  {!proc.completed_at ? (
                    <Button
                      icon={isDone ? 'arrow-undo-outline' : 'checkmark-outline'}
                      label={isDone ? 'Reabrir etapa' : 'Concluir etapa'}
                      loading={isToggling}
                      onPress={() => handleToggle(idx, isDone)}
                      style={styles.stepButton}
                      variant={isDone ? 'secondary' : 'primary'}
                    />
                  ) : <StatusPill label="Onboarding concluído" status="ativo" />}
                </View>
              </Card>
            );
          })}
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  centered: { alignItems: 'center', backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.md, justifyContent: 'center', padding: espaco.xl },
  loading: { backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.lg, padding: espaco.xl },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: espaco.xs },
  processSummary: { gap: espaco.lg },
  metricsRow: { flexDirection: 'row', gap: espaco.md },
  metric: { flex: 1 },
  stepList: { gap: espaco.md },
  completedStep: { opacity: 0.7 },
  stepBody: { alignItems: 'flex-start', gap: espaco.sm, paddingHorizontal: espaco.lg, paddingVertical: espaco.sm },
  completedBy: { ...tipografia.legenda, color: cores.status.sucesso.forte },
  stepActions: { borderTopColor: cores.borda.sutil, borderTopWidth: 1, padding: espaco.sm },
  stepButton: { width: '100%' },
});
