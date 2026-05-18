// ============================================================
// app/onboarding/index.tsx — Lista de processos de onboarding
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getOnboardings, deleteOnboarding } from '../../conexoes/onboarding';
import { OnboardingProcess } from '../../tipos/modelos';
import { theme } from '../../estilo/cores';
import { useToast } from '../../contextos/Toast';

function calcProgress(proc: OnboardingProcess): { done: number; total: number; pct: number } {
  const total = proc.steps_snapshot.length;
  const done  = Object.values(proc.steps_progress).filter(s => s.completed).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function OnboardingListScreen() {
  const router = useRouter();
  const toast  = useToast();
  const [processes,  setProcesses]  = useState<OnboardingProcess[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone,   setShowDone]   = useState(false);

  const load = useCallback(async () => {
    try {
      setProcesses(await getOnboardings(false));
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível carregar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  async function handleDelete(proc: OnboardingProcess) {
    Alert.alert('Cancelar onboarding', `Encerrar o onboarding de ${proc.employee_name}?`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Encerrar', style: 'destructive', onPress: async () => {
          try { await deleteOnboarding(proc.id); load(); }
          catch (e: any) { toast.error(e?.message ?? 'Erro ao encerrar onboarding'); }
        },
      },
    ]);
  }

  const active    = processes.filter(p => !p.completed_at);
  const completed = processes.filter(p =>  p.completed_at);
  const shown     = showDone ? processes : active;

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Onboarding Digital</Text>
          <Text style={styles.headerSub}>
            {active.length} ativo{active.length !== 1 ? 's' : ''} · {completed.length} concluído{completed.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {completed.length > 0 && (
          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowDone(v => !v)}>
            <Text style={styles.toggleText}>{showDone ? 'Só ativos' : 'Ver todos'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Lista */}
      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>
            {active.length === 0 ? 'Nenhum onboarding ativo' : 'Sem processos para mostrar'}
          </Text>
          <Text style={styles.emptySub}>
            Inicie um onboarding a partir do perfil de um colaborador
          </Text>
          <TouchableOpacity style={styles.goBtn} onPress={() => router.push('/(tabs)/colaboradores' as any)}>
            <Ionicons name="people-outline" size={15} color={theme.bg} />
            <Text style={styles.goBtnText}>Ver colaboradores</Text>
          </TouchableOpacity>
        </View>
      ) : (
        shown.map((proc, i) => {
          const { done, total, pct } = calcProgress(proc);
          const days = daysSince(proc.started_at);
          const isComplete = !!proc.completed_at;
          const barColor = isComplete ? theme.success : pct >= 70 ? theme.info : pct >= 40 ? theme.warning : theme.danger;

          return (
            <Animated.View key={proc.id} entering={FadeInDown.delay(i * 50).duration(300)}>
              <TouchableOpacity
                style={[styles.card, isComplete && styles.cardDone]}
                onPress={() => router.push(`/onboarding/${proc.id}` as any)}
                activeOpacity={0.75}
              >
                {/* Avatar + nome */}
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(proc.employee_name ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{proc.employee_name}</Text>
                    <Text style={styles.empRole}>{proc.role_title ?? ''}{proc.department_name ? ` · ${proc.department_name}` : ''}</Text>
                  </View>
                  {isComplete
                    ? <View style={styles.doneBadge}><Ionicons name="checkmark-circle" size={20} color={theme.success} /></View>
                    : <TouchableOpacity onPress={() => handleDelete(proc)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle-outline" size={20} color={theme.textMuted} />
                      </TouchableOpacity>
                  }
                </View>

                {/* Barra de progresso */}
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.progressPct, { color: barColor }]}>{pct}%</Text>
                </View>

                {/* Meta */}
                <View style={styles.cardMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="list-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{done}/{total} etapas</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>
                      {isComplete
                        ? `Concluído em ${daysSince(proc.completed_at!)}d`
                        : `${days}d em andamento`}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="clipboard-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{proc.template_name}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content:   { padding: 16 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: theme.white },
  headerSub:   { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  toggleBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  toggleText:  { fontSize: 12, color: theme.gold, fontWeight: '600' },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
  emptySub:   { fontSize: 13, color: theme.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  goBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: theme.gold, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  goBtnText:  { fontSize: 13, fontWeight: '700', color: theme.bg },

  card: {
    backgroundColor: 'rgba(24,27,33,0.92)', borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 12,
  },
  cardDone: { opacity: 0.7 },

  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: theme.gold },
  empName:    { fontSize: 14, fontWeight: '700', color: theme.white, marginBottom: 2 },
  empRole:    { fontSize: 12, color: theme.textMuted },
  doneBadge:  {},

  progressWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressPct:   { fontSize: 12, fontWeight: '800', width: 36, textAlign: 'right' },

  cardMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { fontSize: 11, color: theme.textMuted },
});
