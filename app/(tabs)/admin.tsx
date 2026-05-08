// ============================================================
// app/(tabs)/admin.tsx — Gerenciamento de Usuários (super_admin)
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { getUsers, createUser, updateUser, deleteUser, SystemUser } from '../../conexoes/usuarios';
import { theme } from '../../estilo/cores';

const ROLES: { key: string; label: string; color: string }[] = [
  { key: 'super_admin', label: 'Super Admin', color: theme.gold },
  { key: 'admin',       label: 'Admin',       color: theme.danger },
  { key: 'rh',          label: 'RH',          color: theme.info },
  { key: 'gestor',      label: 'Gestor',       color: theme.success },
  { key: 'ti',          label: 'TI',           color: '#9B72CF' },
  { key: 'financeiro',  label: 'Financeiro',   color: '#E8955A' },
  { key: 'adm',         label: 'Administrativo', color: theme.textLight },
  { key: 'colaborador', label: 'Colaborador',  color: theme.textMuted },
];

function getRoleInfo(role: string) {
  return ROLES.find(r => r.key === role) ?? { key: role, label: role, color: theme.textMuted };
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'rh' };

type ModalMode = 'create' | 'edit';

export default function AdminScreen() {
  const { user } = useAuth();

  const [users,      setUsers]      = useState<SystemUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [modalMode,  setModalMode]  = useState<ModalMode>('create');
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [showPass,   setShowPass]   = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await getUsers());
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível carregar usuários.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function setF(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setModalMode('create');
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowPass(false);
    setShowModal(true);
  }

  function openEdit(u: SystemUser) {
    setModalMode('edit');
    setEditTarget(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowPass(false);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim())  return Alert.alert('Campo obrigatório', 'Informe o nome.');
    if (!form.email.trim()) return Alert.alert('Campo obrigatório', 'Informe o email.');
    if (modalMode === 'create' && !form.password) return Alert.alert('Campo obrigatório', 'Informe a senha.');

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const created = await createUser({
          name:     form.name.trim(),
          email:    form.email.trim(),
          password: form.password,
          role:     form.role,
        });
        setUsers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await updateUser(editTarget!.id, {
          name:     form.name.trim(),
          email:    form.email.trim(),
          role:     form.role,
          password: form.password || undefined,
        });
        setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(u: SystemUser) {
    if (u.id === user?.id) {
      return Alert.alert('Atenção', 'Você não pode excluir sua própria conta.');
    }
    Alert.alert(
      'Excluir usuário',
      `Deseja excluir ${u.name}? O acesso ao sistema será removido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(u.id);
              setUsers(prev => prev.filter(x => x.id !== u.id));
            } catch (e: any) {
              Alert.alert('Erro', e.message);
            }
          },
        },
      ],
    );
  }

  if (user?.role !== 'super_admin') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed" size={40} color={theme.textMuted} />
        <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: 14 }}>Acesso restrito</Text>
      </View>
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
      <View style={styles.banner}>
        <Ionicons name="shield-checkmark" size={16} color={theme.gold} />
        <Text style={styles.bannerText}>{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />}
      >
        {users.map((u, i) => {
          const roleInfo = getRoleInfo(u.role);
          const isMe = u.id === user?.id;
          return (
            <Animated.View key={u.id} entering={FadeInDown.delay(i * 40).duration(300)}>
              <TouchableOpacity style={styles.userRow} onPress={() => openEdit(u)} activeOpacity={0.75}>
                <View style={[styles.avatar, { borderColor: `${roleInfo.color}40` }]}>
                  <Text style={[styles.avatarText, { color: roleInfo.color }]}>
                    {u.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </Text>
                </View>

                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{u.name}</Text>
                    {isMe && <Text style={styles.meTag}>você</Text>}
                  </View>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={[styles.rolePill, { backgroundColor: `${roleInfo.color}18` }]}>
                    <Text style={[styles.roleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                  </View>
                </View>

                <View style={styles.userActions}>
                  <TouchableOpacity onPress={() => openEdit(u)} style={styles.actionBtn}>
                    <Ionicons name="pencil-outline" size={16} color={theme.gold} />
                  </TouchableOpacity>
                  {!isMe && (
                    <TouchableOpacity onPress={() => handleDelete(u)} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Ionicons name="person-add" size={22} color="#000" />
      </TouchableOpacity>

      {/* Modal criar/editar */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor={theme.textMuted}
              value={form.name}
              onChangeText={v => setF('name', v)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="email@empresa.com"
              placeholderTextColor={theme.textMuted}
              value={form.email}
              onChangeText={v => setF('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>
              {modalMode === 'create' ? 'Senha *' : 'Nova senha (deixe em branco para manter)'}
            </Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder={modalMode === 'create' ? 'Mínimo 6 caracteres' : '••••••'}
                placeholderTextColor={theme.textMuted}
                value={form.password}
                onChangeText={v => setF('password', v)}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Cargo / Nível de acesso</Text>
            <View style={styles.rolesGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleChip, form.role === r.key && { backgroundColor: `${r.color}20`, borderColor: `${r.color}60` }]}
                  onPress={() => setF('role', r.key)}
                >
                  <View style={[styles.roleDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.roleChipText, form.role === r.key && { color: r.color }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowModal(false)}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={styles.btnSaveText}>{modalMode === 'create' ? 'Criar conta' : 'Salvar'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.bg },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.goldGlow,
    borderBottomWidth: 1, borderBottomColor: theme.border2,
  },
  bannerText: { fontSize: 12, color: theme.gold, fontWeight: '600' },

  list: { flex: 1 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.surface, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 14, fontWeight: '700' },
  userInfo:    { flex: 1, gap: 2 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName:    { fontSize: 14, fontWeight: '600', color: theme.white },
  meTag:       { fontSize: 10, color: theme.gold, fontWeight: '600', backgroundColor: theme.goldDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  userEmail:   { fontSize: 12, color: theme.textMuted },
  rolePill:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  roleText:    { fontSize: 10, fontWeight: '600' },

  userActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { padding: 6 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: theme.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.gold, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  modal:       { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.white },
  modalBody:  { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  label: { fontSize: 11, color: theme.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, marginTop: 16, textTransform: 'uppercase' },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: theme.text, marginBottom: 2,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:      { padding: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8 },

  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  roleDot:      { width: 8, height: 8, borderRadius: 4 },
  roleChipText: { fontSize: 12, color: theme.textMuted, fontWeight: '500' },

  modalFooter: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  btnCancel:     { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  btnCancelText: { fontSize: 14, color: theme.textMuted, fontWeight: '600' },
  btnSave:       { flex: 2, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.gold, alignItems: 'center' },
  btnSaveText:   { fontSize: 14, fontWeight: '700', color: '#000' },
});
