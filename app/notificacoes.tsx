// ============================================================
// app/notificacoes.tsx — Centro de Notificações
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buscarNotificacoes, marcarLida, marcarTodasLidas, Notificacao } from '../conexoes/notificacoes';
import { theme } from '../estilo/cores';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  ferias:       { icon: 'umbrella-outline',   color: theme.info },
  aviso:        { icon: 'megaphone-outline',  color: theme.warning },
  pesquisa:     { icon: 'bar-chart-outline',  color: theme.success },
  onboarding:   { icon: 'rocket-outline',     color: '#A78BFA' },
  reconhecimento: { icon: 'trophy-outline',   color: theme.gold },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function NotificacoesScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<Notificacao[]>([]);
  const [unread,     setUnread]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await buscarNotificacoes();
      setItems(data.notifications);
      setUnread(data.unread);
    } catch { /* silencioso */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleTap(item: Notificacao) {
    if (!item.read) {
      await marcarLida(item.id).catch(() => {});
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (item.route) router.push(item.route as any);
  }

  async function handleMarcarTodas() {
    await marcarTodasLidas().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={handleMarcarTodas} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.gold} />}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptySub}>As notificações aparecerão aqui quando houver atualizações.</Text>
          </View>
        ) : (
          items.map((item, i) => {
            const meta = TYPE_ICONS[item.type ?? ''] ?? { icon: 'notifications-outline', color: theme.textMuted };
            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(i * 30).duration(280)}>
                <TouchableOpacity
                  style={[styles.item, !item.read && styles.itemUnread]}
                  onPress={() => handleTap(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${meta.color}18` }]}>
                    <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTop}>
                      <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                    {item.body ? (
                      <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                    ) : null}
                  </View>
                  {!item.read && <View style={styles.dot} />}
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn:     { padding: 6 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.white, marginHorizontal: 8 },
  markAllBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.border2 },
  markAllText: { fontSize: 11, color: theme.gold, fontWeight: '600' },

  content: { paddingVertical: 8 },

  empty:      { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textMuted },
  emptySub:   { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  itemUnread:      { backgroundColor: 'rgba(201,168,76,0.04)' },
  iconWrap:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  itemTitle:       { fontSize: 13, color: theme.textLight, fontWeight: '500', flex: 1 },
  itemTitleUnread: { color: theme.white, fontWeight: '700' },
  itemTime:        { fontSize: 10, color: theme.textMuted, marginLeft: 8 },
  itemBody:        { fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: theme.gold, marginLeft: 4,
  },
});
