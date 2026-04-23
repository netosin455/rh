// ============================================================
// app/(tabs)/colaboradores.tsx — SuperRH
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEmployees } from '../../services/employees';
import { Employee, EmployeeStatus, STATUS_LABELS } from '../../types';
import { theme } from '../../theme';

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  ativo:     theme.success,
  ferias:    theme.info,
  licenca:   theme.warning,
  afastado:  theme.warning,
  desligado: theme.textMuted,
};

const FILTERS: { key: EmployeeStatus | 'todos'; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ativo',    label: 'Ativos' },
  { key: 'ferias',   label: 'Férias' },
  { key: 'licenca',  label: 'Licença' },
  { key: 'afastado', label: 'Afastado' },
];

export default function ColaboradoresScreen() {
  const router = useRouter();
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<EmployeeStatus | 'todos'>('todos');

  const load = useCallback(async () => {
    try {
      setEmployees(await getEmployees());
    } catch (e) {
      console.error('[Colaboradores]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const matchStatus = filter === 'todos' || e.status === filter;
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role_title.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [employees, filter, search]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar colaborador..."
          placeholderTextColor={theme.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterRow} contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contagem */}
      <Text style={styles.countLabel}>{filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}</Text>

      {/* Lista */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>Nenhum colaborador encontrado</Text>
          </View>
        ) : (
          filtered.map((emp, i) => (
            <Animated.View key={emp.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <TouchableOpacity
                style={styles.empRow}
                onPress={() => router.push(`/colaborador/${emp.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={styles.avatar}>
                  <Text style={styles.initials}>
                    {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </Text>
                </View>
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{emp.name}</Text>
                  <Text style={styles.empRole}>{emp.role_title}</Text>
                  {emp.oab_number && (
                    <Text style={styles.empOab}>OAB {emp.oab_number}</Text>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[emp.status]}20` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[emp.status] }]}>
                    {STATUS_LABELS[emp.status]}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
              </TouchableOpacity>
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

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderBottomWidth: 1,
    borderBottomColor: theme.border, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: theme.text },

  filterRow:    { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: theme.border },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  filterChipActive: { backgroundColor: theme.goldDim, borderColor: theme.border2 },
  filterText:       { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  filterTextActive: { color: theme.gold },

  countLabel: { fontSize: 11, color: theme.textMuted, paddingHorizontal: 16, paddingVertical: 8 },

  list: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 13, color: theme.textMuted },

  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
  },
  initials:  { fontSize: 13, fontWeight: '700', color: theme.goldLight },
  empInfo:   { flex: 1 },
  empName:   { fontSize: 14, fontWeight: '600', color: theme.text },
  empRole:   { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  empOab:    { fontSize: 10, color: theme.gold, marginTop: 2, fontFamily: 'monospace' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
});
