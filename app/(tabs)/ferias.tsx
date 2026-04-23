// ============================================================
// app/(tabs)/ferias.tsx — SuperRH
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAbsences, approveAbsence } from '../../services/absences';
import { getEmployees } from '../../services/employees';
import { Absence, AbsenceStatus, ABSENCE_TYPE_LABELS } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme';
import { formatDateShort } from '../../utils/dateUtils';

const STATUS_COLORS: Record<AbsenceStatus, string> = {
  pendente:  theme.warning,
  aprovado:  theme.success,
  recusado:  theme.danger,
  cancelado: theme.textMuted,
};

const STATUS_LABELS: Record<AbsenceStatus, string> = {
  pendente:  'Pendente',
  aprovado:  'Aprovado',
  recusado:  'Recusado',
  cancelado: 'Cancelado',
};

const TABS: { key: AbsenceStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aprovado', label: 'Aprovados' },
  { key: 'recusado', label: 'Recusados' },
];

export default function FeriasScreen() {
  const { user } = useAuth();
  const canApprove = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'rh';

  const [absences,   setAbsences]   = useState<Absence[]>([]);
  const [empNames,   setEmpNames]   = useState<Record<number, string>>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab,  setActiveTab]  = useState<AbsenceStatus | 'todos'>('todos');
  const [approving,  setApproving]  = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [abs, emps] = await Promise.all([
        getAbsences(),
        getEmployees(),
      ]);
      setAbsences(abs);
      const names: Record<number, string> = {};
      emps.forEach(e => { names[e.id] = e.name; });
      setEmpNames(names);
    } catch (e) {
      console.error('[Ferias]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = useMemo(() =>
    activeTab === 'todos'
      ? absences
      : absences.filter(a => a.status === activeTab),
    [absences, activeTab],
  );

  const pendingCount = absences.filter(a => a.status === 'pendente').length;

  async function handleApprove(id: number, approved: boolean) {
    const label = approved ? 'aprovar' : 'recusar';
    Alert.alert(
      approved ? 'Aprovar solicitação' : 'Recusar solicitação',
      `Deseja ${label} esta solicitação?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: approved ? 'Aprovar' : 'Recusar',
          style: approved ? 'default' : 'destructive',
          onPress: async () => {
            setApproving(id);
            try {
              const updated = await approveAbsence(id, approved);
              setAbsences(prev => prev.map(a => a.id === id ? updated : a));
            } catch (e: any) {
              Alert.alert('Erro', e.message || 'Não foi possível processar.');
            } finally {
              setApproving(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Banner pendentes */}
      {pendingCount > 0 && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={14} color={theme.warning} />
          <Text style={styles.pendingText}>
            {pendingCount} solicitaç{pendingCount > 1 ? 'ões' : 'ão'} aguardando aprovação
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.key === 'pendente' && pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="umbrella-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhuma solicitação encontrada</Text>
          </View>
        ) : (
          filtered.map((absence, i) => (
            <Animated.View key={absence.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <View style={styles.card}>
                {/* Topo do card */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.empName}>
                      {empNames[absence.employee_id] || `Colaborador #${absence.employee_id}`}
                    </Text>
                    <Text style={styles.absenceType}>
                      {ABSENCE_TYPE_LABELS[absence.type]}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[absence.status]}20` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[absence.status] }]}>
                      {STATUS_LABELS[absence.status]}
                    </Text>
                  </View>
                </View>

                {/* Datas */}
                <View style={styles.datesRow}>
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>INÍCIO</Text>
                    <Text style={styles.dateValue}>{formatDateShort(absence.start_date)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={12} color={theme.textMuted} />
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>FIM</Text>
                    <Text style={styles.dateValue}>{formatDateShort(absence.end_date)}</Text>
                  </View>
                  <View style={styles.daysChip}>
                    <Text style={styles.daysText}>{absence.days_count}d</Text>
                  </View>
                </View>

                {/* Motivo */}
                {absence.reason ? (
                  <Text style={styles.reason} numberOfLines={2}>{absence.reason}</Text>
                ) : null}

                {/* Ações — só para quem pode aprovar e status pendente */}
                {canApprove && absence.status === 'pendente' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.btnRecusar}
                      onPress={() => handleApprove(absence.id, false)}
                      disabled={approving === absence.id}
                    >
                      {approving === absence.id
                        ? <ActivityIndicator size="small" color={theme.danger} />
                        : <Text style={styles.btnRecusarText}>Recusar</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnAprovar}
                      onPress={() => handleApprove(absence.id, true)}
                      disabled={approving === absence.id}
                    >
                      {approving === absence.id
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={styles.btnAprovarText}>Aprovar</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pendingText: { fontSize: 12, color: theme.warning, fontWeight: '600' },

  tabsRow: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: theme.gold },
  tabText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  tabTextActive: { color: theme.gold, fontWeight: '600' },
  badge: {
    backgroundColor: theme.warning, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#000' },

  list:      { flex: 1, padding: 12 },
  empty:     { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  card: {
    backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    padding: 14, marginBottom: 10,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTopLeft: { flex: 1, marginRight: 10 },
  empName:     { fontSize: 14, fontWeight: '600', color: theme.text },
  absenceType: { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },

  datesRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dateBlock: { alignItems: 'center' },
  dateLabel: { fontSize: 9, color: theme.textMuted, letterSpacing: 1, marginBottom: 2 },
  dateValue: { fontSize: 13, fontWeight: '600', color: theme.text },
  daysChip:  {
    marginLeft: 'auto',
    backgroundColor: theme.goldDim,
    borderWidth: 1, borderColor: theme.border2,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  daysText: { fontSize: 12, fontWeight: '700', color: theme.gold },

  reason: { fontSize: 12, color: theme.textMuted, marginBottom: 10 },

  actions:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnRecusar: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: `${theme.danger}40`,
    alignItems: 'center',
  },
  btnRecusarText: { fontSize: 12, fontWeight: '600', color: theme.danger },
  btnAprovar: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    backgroundColor: theme.gold, alignItems: 'center',
  },
  btnAprovarText: { fontSize: 12, fontWeight: '700', color: '#000' },
});
