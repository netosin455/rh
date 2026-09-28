// ============================================================
// app/(tabs)/admin.tsx — Administração de usuários (super_admin)
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuth } from '../../contextos/Autenticacao';
import { useToast } from '../../contextos/Toast';
import { createUser, deleteUser, getUsers, SystemUser, updateUser } from '../../conexoes/usuarios';
import { Avatar } from '../../componentes/Avatar';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';
import { confirmAction } from '../../helpers/confirm';

type BadgeTone = 'gold' | 'success' | 'danger' | 'info' | 'muted';

const ROLES: { key: string; label: string; tone: BadgeTone }[] = [
  { key: 'super_admin', label: 'Super Admin', tone: 'gold' },
  { key: 'admin', label: 'Admin', tone: 'danger' },
  { key: 'rh', label: 'RH', tone: 'info' },
  { key: 'gestor', label: 'Gestor', tone: 'success' },
  { key: 'juridico', label: 'Jurídico', tone: 'info' },
  { key: 'ti', label: 'TI', tone: 'gold' },
  { key: 'financeiro', label: 'Financeiro', tone: 'success' },
  { key: 'adm', label: 'Administrativo', tone: 'muted' },
  { key: 'colaborador', label: 'Colaborador', tone: 'muted' },
];

function getRoleInfo(role: string) {
  return ROLES.find((item) => item.key === role) ?? { key: role, label: role, tone: 'muted' as const };
}

const EMPTY_FORM = { name: '', email: '', username: '', password: '', role: 'rh' };

type ModalMode = 'create' | 'edit';

export default function AdminScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const motion = useMotion();

  const [users,      setUsers]      = useState<SystemUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [modalMode,  setModalMode]  = useState<ModalMode>('create');
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [showPass,   setShowPass]   = useState(false);
  const [modalError, setModalError] = useState('');
  const [latestCreatedId, setLatestCreatedId] = useState<number | string | null>(null);

  const newUserEntering = useMemo(
    () => FadeIn.duration(motion.duracao('normal')),
    [motion],
  );

  const load = useCallback(async () => {
    // Sem ser super_admin, a tela só mostra "Acesso restrito" (abaixo); buscar a
    // lista de contas aqui seria uma chamada que sempre falha (403) à toa.
    if (user?.role !== 'super_admin') { setLoading(false); return; }
    setLoadError('');
    try {
      setUsers(await getUsers());
    } catch (error: any) {
      console.error('[AdminScreen] Erro ao carregar usuários:', error.message);
      setLoadError(error.message || 'Não foi possível carregar os usuários. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function setF(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function closeModal() {
    if (!saving) setShowModal(false);
  }

  function openCreate() {
    setModalMode('create');
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowPass(false);
    setModalError('');
    setShowModal(true);
  }

  function openEdit(u: SystemUser) {
    setModalMode('edit');
    setEditTarget(u);
    setForm({ name: u.name, email: u.email, username: u.username ?? '', password: '', role: u.role });
    setShowPass(false);
    setModalError('');
    setShowModal(true);
  }

  async function handleSave() {
    setModalError('');
    if (!form.name.trim())                                { setModalError('Informe o nome.'); return; }
    // TEMPORÁRIO (pedido do Carlo, 2026-09-28): email so obrigatorio ao editar;
    // ao criar, pode ficar em branco por enquanto (a API preenche um placeholder).
    if (modalMode === 'edit' && !form.email.trim())        { setModalError('Informe o email.'); return; }
    if (modalMode === 'create' && !form.username.trim())  { setModalError('Informe o nome de usuário (usado no login).'); return; }
    if (modalMode === 'create' && !form.password)         { setModalError('Informe a senha.'); return; }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const created = await createUser({
          name:     form.name.trim(),
          email:    form.email.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role:     form.role,
        });
        setUsers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setLatestCreatedId(created.id);
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
      setModalError(e.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(u: SystemUser) {
    if (u.id === user?.id) {
      setModalError('Você não pode excluir sua própria conta.');
      return;
    }
    confirmAction('Excluir usuário', `Excluir ${u.name}? O acesso ao sistema será removido.`, async () => {
      try {
        await deleteUser(u.id);
        setUsers(prev => prev.filter(x => x.id !== u.id));
        toast.success('Usuário excluído.');
      } catch (e: any) {
        toast.error(e.message || 'Não foi possível excluir o usuário.');
      }
    });
  }

  if (user?.role !== 'super_admin') {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="lock-closed-outline"
          title="Acesso restrito"
          description="Somente super administradores podem gerenciar as contas do sistema."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader
          title="Administração"
          subtitle="Gerencie contas e níveis de acesso do sistema."
          action={<Button icon="person-add-outline" label="Nova conta" onPress={openCreate} />}
        />

        <MetricCard
          label="Contas cadastradas"
          value={loading ? '—' : users.length}
          detail="Usuários com acesso ao SuperRH"
          indicator={<StatusPill label="Acesso" status="ativo" />}
        />

        <Section title="Usuários" description="Selecione uma conta para editar seus dados ou permissões.">
          {loading ? (
            <Card style={styles.listCard} padded={false}>
              <Skeleton style={styles.skeleton} accessibilityLabel="Carregando lista de usuários" />
              <Skeleton style={styles.skeleton} accessibilityLabel="Carregando lista de usuários" />
              <Skeleton style={styles.skeleton} accessibilityLabel="Carregando lista de usuários" />
            </Card>
          ) : loadError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Não foi possível carregar os usuários"
              description={loadError}
              action={<Button label="Tentar novamente" icon="refresh-outline" onPress={load} />}
            />
          ) : users.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="Nenhuma conta cadastrada"
              description="Crie a primeira conta para conceder acesso ao sistema."
              action={<Button label="Criar conta" icon="person-add-outline" onPress={openCreate} />}
            />
          ) : (
            <Card style={styles.listCard} padded={false}>
              {users.map((item) => {
                const roleInfo = getRoleInfo(item.role);
                const isCurrentUser = item.id === user?.id;
                return (
                  <Animated.View entering={item.id === latestCreatedId ? newUserEntering : undefined} key={item.id}>
                    <ListRow
                      accessibilityLabel={`Editar ${item.name}`}
                      title={item.name}
                      description={item.email || item.username || 'Sem email informado'}
                      leading={<Avatar name={item.name} />}
                      trailing={(
                        <View style={styles.rowActions}>
                          <View style={styles.rowBadges}>
                            {isCurrentUser ? <StatusPill label="Você" status="ativo" /> : null}
                            <Badge label={roleInfo.label} tone={roleInfo.tone} />
                          </View>
                          <Button accessibilityLabel={`Editar ${item.name}`} icon="pencil-outline" onPress={() => openEdit(item)} variant="ghost" />
                          {!isCurrentUser ? (
                            <Button accessibilityLabel={`Excluir ${item.name}`} icon="trash-outline" onPress={() => handleDelete(item)} variant="danger" />
                          ) : null}
                        </View>
                      )}
                    />
                  </Animated.View>
                );
              })}
            </Card>
          )}
        </Section>
      </ScrollView>

      <Modal
        footer={(
          <View style={styles.footerActions}>
            <Button label="Cancelar" disabled={saving} onPress={closeModal} style={styles.footerButton} variant="secondary" />
            <Button
              label={modalMode === 'create' ? 'Criar conta' : 'Salvar alterações'}
              loading={saving}
              onPress={handleSave}
              style={styles.footerButton}
            />
          </View>
        )}
        onClose={closeModal}
        subtitle={modalMode === 'create' ? 'Defina os dados e o nível de acesso.' : 'Atualize os dados ou as permissões desta conta.'}
        title={modalMode === 'create' ? 'Nova conta' : 'Editar conta'}
        visible={showModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Input
              autoCapitalize="words"
              editable={!saving}
              label="Nome *"
              onChangeText={(value) => setF('name', value)}
              placeholder="Nome completo"
              value={form.name}
            />
            <Input
              autoCapitalize="none"
              editable={!saving}
              keyboardType="email-address"
              label="Email *"
              onChangeText={(value) => setF('email', value)}
              placeholder="email@empresa.com"
              value={form.email}
            />
            {modalMode === 'create' ? (
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                editable={!saving}
                label="Usuário *"
                onChangeText={(value) => setF('username', value.toLowerCase().replace(/\s/g, ''))}
                placeholder="Ex.: joao.silva"
                value={form.username}
              />
            ) : null}
            <Input
              autoCapitalize="none"
              editable={!saving}
              label={modalMode === 'create' ? 'Senha *' : 'Nova senha'}
              onChangeText={(value) => setF('password', value)}
              placeholder={modalMode === 'create' ? 'Mínimo de 6 caracteres' : 'Deixe em branco para manter'}
              rightAccessory={(
                <Button
                  accessibilityLabel={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={saving}
                  icon={showPass ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPass((current) => !current)}
                  variant="ghost"
                />
              )}
              secureTextEntry={!showPass}
              value={form.password}
            />

            <Section title="Nível de acesso" description="Escolha as permissões que esta conta terá.">
              <View style={styles.rolesGrid}>
                {ROLES.map((role) => {
                  const selected = form.role === role.key;
                  return (
                    <Button
                      accessibilityLabel={`${selected ? 'Selecionado' : 'Selecionar'}: ${role.label}`}
                      disabled={saving}
                      icon={selected ? 'checkmark' : undefined}
                      key={role.key}
                      label={role.label}
                      onPress={() => setF('role', role.key)}
                      style={styles.roleButton}
                      variant={selected ? 'primary' : 'secondary'}
                    />
                  );
                })}
              </View>
            </Section>

            {modalError ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Ionicons color={cores.status.erro.forte} name="alert-circle-outline" size={20} />
                <Text style={styles.errorText}>{modalError}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  centered: { backgroundColor: cores.superficie.pagina, flex: 1, justifyContent: 'center' },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  listCard: { overflow: 'hidden' },
  skeleton: { marginHorizontal: espaco.md, marginVertical: espaco.sm },
  rowActions: { alignItems: 'center', flexDirection: 'row', gap: espaco.xs },
  rowBadges: { alignItems: 'flex-end', gap: espaco.xs },
  footerActions: { flexDirection: 'row', gap: espaco.md },
  footerButton: { flex: 1 },
  form: { gap: espaco.lg, paddingBottom: espaco.xs },
  rolesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  roleButton: { minWidth: espaco.tela },
  errorBox: {
    alignItems: 'center',
    backgroundColor: cores.status.erro.superficie,
    borderColor: cores.status.erro.borda,
    borderWidth: 1,
    flexDirection: 'row',
    gap: espaco.sm,
    padding: espaco.md,
  },
  errorText: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
});
