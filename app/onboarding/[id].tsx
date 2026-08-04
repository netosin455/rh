// ============================================================
// app/onboarding/[id].tsx — Checklist interativo de onboarding
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOnboarding, markStep, deleteOnboarding } from '../../conexoes/onboarding';
import { OnboardingProcess, OnboardingStep, StepProgress } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { useToast } from '../../contextos/Toast';
import { confirmAction } from '../../helpers/confirm';

const ROLE_LABELS: Record<string, string> = {
  rh:     'RH',
  gestor: 'Gestor',
  ti:     'TI',
  adm:    'Administrativo',
};
const ROLE_COLORS: Record<string, string> = {
  rh:     theme.gold,
  gestor: theme.info,
  ti:     theme.success,
  adm:    '#A78BFA',
};

function calcProgress(proc: OnboardingProcess) {
  const total = proc.steps_snapshot.length;
  const done  = Object.values(proc.steps_progress).filter(s => s.completed).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={theme.gold} size="large" /></View>;
  }

  if (loadError || !proc) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
        <Text style={styles.errorText}>{loadError ?? 'Processo não encontrado'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { done, total, pct } = calcProgress(proc);
  const barColor = proc.completed_at ? theme.success : pct >= 70 ? theme.info : pct >= 40 ? theme.warning : theme.danger;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Voltar */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color={theme.gold} />
        <Text style={styles.backText}>Onboarding</Text>
      </TouchableOpacity>

      {/* Header do colaborador */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(proc.employee_name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{proc.employee_name}</Text>
            <Text style={styles.empRole}>{proc.role_title}{proc.department_name ? ` · ${proc.department_name}` : ''}</Text>
          </View>
          {!proc.completed_at && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Ionicons name="close" size={15} color={theme.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Progresso */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[styles.progressPct, { color: barColor }]}>{pct}%</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: barColor }]}>{done}/{total}</Text>
            <Text style={styles.statLabel}>Etapas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDate(proc.started_at)}</Text>
            <Text style={styles.statLabel}>Início</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: proc.completed_at ? theme.success : theme.textLight }]}>
              {proc.completed_at ? formatDate(proc.completed_at) : 'Em andamento'}
            </Text>
            <Text style={styles.statLabel}>Conclusão</Text>
          </View>
        </View>

        {proc.completed_at && (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            <Text style={styles.completedText}>Onboarding concluído com sucesso!</Text>
          </View>
        )}
      </Animated.View>

      {/* Template */}
      <View style={styles.templateRow}>
        <Ionicons name="clipboard-outline" size={13} color={theme.textMuted} />
        <Text style={styles.templateText}>Template: {proc.template_name}</Text>
      </View>

      {/* Checklist */}
      <Text style={styles.checklistTitle}>Checklist de Etapas</Text>

      {proc.steps_snapshot.map((step: OnboardingStep, idx: number) => {
        const progress: StepProgress = proc.steps_progress[String(idx)] ?? { completed: false };
        const isDone    = progress.completed;
        const isToggling = toggling === idx;
        const roleColor = ROLE_COLORS[step.responsible_role] ?? theme.textMuted;
        const deadline  = new Date(proc.started_at);
        deadline.setDate(deadline.getDate() + step.days_deadline);
        const isLate = !isDone && deadline < new Date() && !proc.completed_at;

        return (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 40).duration(300)}>
            <TouchableOpacity
              style={[
                styles.stepCard,
                isDone    && styles.stepCardDone,
                isLate    && styles.stepCardLate,
              ]}
              onPress={() => handleToggle(idx, isDone)}
              disabled={!!proc.completed_at || isToggling}
              activeOpacity={0.75}
            >
              <View style={styles.stepLeft}>
                {isToggling
                  ? <ActivityIndicator size="small" color={theme.gold} />
                  : <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                      {isDone && <Ionicons name="checkmark" size={14} color={theme.bg} />}
                    </View>
                }
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.stepHeader}>
                  <Text style={[styles.stepTitle, isDone && styles.stepTitleDone]}>
                    {step.title}
                  </Text>
                  <View style={[styles.roleTag, { backgroundColor: `${roleColor}18` }]}>
                    <Text style={[styles.roleTagText, { color: roleColor }]}>
                      {ROLE_LABELS[step.responsible_role] ?? step.responsible_role}
                    </Text>
                  </View>
                </View>

                {step.description ? (
                  <Text style={[styles.stepDesc, isDone && { opacity: 0.5 }]} numberOfLines={2}>
                    {step.description}
                  </Text>
                ) : null}

                <View style={styles.stepMeta}>
                  <Ionicons
                    name="calendar-outline" size={11}
                    color={isLate ? theme.danger : theme.textMuted}
                  />
                  <Text style={[styles.stepDeadline, isLate && { color: theme.danger }]}>
                    Prazo: D+{step.days_deadline} ({deadline.toLocaleDateString('pt-BR')})
                    {isLate ? ' · Atrasado' : ''}
                  </Text>
                </View>

                {isDone && progress.completed_by && (
                  <Text style={styles.completedBy}>
                    ✓ Concluído por {progress.completed_by} em {formatDate(progress.completed_at!)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg, gap: 12 },
  errorText: { color: theme.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  backBtn:   { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.goldDim, borderRadius: 10 },
  backBtnText: { color: theme.gold, fontWeight: '700', fontSize: 13 },

  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, color: theme.gold, fontWeight: '600' },

  headerCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 10,
  },
  headerTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: theme.gold },
  empName:    { fontSize: 16, fontWeight: '800', color: theme.white, marginBottom: 2 },
  empRole:    { fontSize: 12, color: theme.textMuted },
  cancelBtn:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: `${theme.danger}44`, alignItems: 'center', justifyContent: 'center' },

  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },
  progressPct:   { fontSize: 14, fontWeight: '800', width: 40, textAlign: 'right' },

  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.border },
  statValue:   { fontSize: 13, fontWeight: '700', color: theme.gold },
  statLabel:   { fontSize: 10, color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },

  completedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, backgroundColor: `${theme.success}12`, borderRadius: 8, borderWidth: 1, borderColor: `${theme.success}30` },
  completedText:   { fontSize: 13, color: theme.success, fontWeight: '600' },

  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  templateText: { fontSize: 12, color: theme.textMuted },

  checklistTitle: { fontSize: 13, fontWeight: '800', color: theme.gold, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 12 },

  stepCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: 'rgba(24,27,33,0.92)', borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 10,
  },
  stepCardDone: { opacity: 0.6 },
  stepCardLate: { borderColor: `${theme.danger}44`, backgroundColor: `${theme.danger}06` },

  stepLeft: { paddingTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: theme.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: theme.success, borderColor: theme.success },

  stepHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  stepTitle:   { fontSize: 14, fontWeight: '700', color: theme.white, flex: 1 },
  stepTitleDone: { textDecorationLine: 'line-through', color: theme.textMuted },
  roleTag:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  roleTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  stepDesc:     { fontSize: 12, color: theme.textMuted, marginBottom: 6, lineHeight: 17 },
  stepMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepDeadline: { fontSize: 11, color: theme.textMuted },
  completedBy:  { fontSize: 11, color: theme.success, marginTop: 6 },
});
