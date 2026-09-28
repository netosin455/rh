// ============================================================
// app/(tabs)/reconhecimentos.tsx — Mural de Reconhecimento
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../../contextos/Toast';
import { Ionicons } from '@expo/vector-icons';
import { getRecognitions, createRecognition, deleteRecognition } from '../../conexoes/reconhecimentos';
import { getEmployees } from '../../conexoes/colaboradores';
import { Recognition, Employee, RECOGNITION_CATEGORIES, RecognitionCategory } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { cores } from '../../estilo/cores';
import { confirmAction } from '../../helpers/confirm';
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
import { borda, espaco, largura, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const CATEGORIES = Object.entries(RECOGNITION_CATEGORIES) as [RecognitionCategory, { label: string; icon: string; color: string }][];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m || 1}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function RecognitionsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [items,      setItems]      = useState<Recognition[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [empSearch,   setEmpSearch]   = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [category,    setCategory]    = useState<RecognitionCategory>('resultado');
  const [message,     setMessage]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [step,        setStep]        = useState<'pick' | 'write'>('pick');

  const load = useCallback(async () => {
    try {
      const res = await getRecognitions();
      setItems(res.data);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível carregar reconhecimentos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openModal() {
    try {
      const emps = await getEmployees();
      setEmployees(emps.filter(e => e.status !== 'desligado'));
    } catch { setEmployees([]); }
    setStep('pick');
    setSelectedEmp(null);
    setEmpSearch('');
    setCategory('resultado');
    setMessage('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!selectedEmp || !message.trim()) return;
    setSaving(true);
    try {
      await createRecognition({ to_employee_id: selectedEmp.id, message: message.trim(), category });
      setModalOpen(false);
      toast.success('Reconhecimento publicado! 🏆');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível publicar o reconhecimento');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(r: Recognition) {
    const canDelete = ['super_admin', 'admin', 'rh', 'adm'].includes(user?.role ?? '') || r.from_user_id === (user as any)?.id;
    if (!canDelete) return;
    confirmAction('Remover', 'Remover este reconhecimento?', async () => {
      try { await deleteRecognition(r.id); toast.success('Reconhecimento removido'); load(); }
      catch (e: any) { toast.error(e?.message ?? 'Não foi possível remover'); }
    });
  }

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.role_title.toLowerCase().includes(empSearch.toLowerCase())
  );

  if (loading) {
    return <View style={styles.container}><View style={styles.loadingContent}><Skeleton height={tamanho.tela} /><Skeleton height={tamanho.tela} /><Skeleton height={tamanho.tela} /></View></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader title="Reconhecimentos" subtitle="Celebre contribuições que fortalecem a equipe." action={<Button label="Dar kudos" icon="add" onPress={openModal} />} />
        <MetricCard label="Reconhecimentos" value={total} detail="Registrados no mural" />

        {items.length === 0 ? (
          <Card><EmptyState icon="trophy-outline" title="Nenhum reconhecimento ainda" description="Seja a primeira pessoa a celebrar alguém da equipe." action={<Button label="Dar kudos" icon="add" onPress={openModal} />} /></Card>
        ) : (
          <Section title="Mural" description="Mensagens enviadas pela equipe."><View style={styles.recognitionList}>{items.map((recognition) => {
            const cat = RECOGNITION_CATEGORIES[recognition.category] ?? RECOGNITION_CATEGORIES.outro;
            const canDelete = ['super_admin', 'admin', 'rh', 'adm'].includes(user?.role ?? '') || recognition.from_user_id === (user as any)?.id;
            return (
              <Card key={recognition.id} padded={false}>
                <ListRow title={`${recognition.from_name} reconheceu ${recognition.to_name}`} description={[recognition.to_role, timeAgo(recognition.created_at)].filter(Boolean).join(' · ')} leading={<Avatar name={recognition.from_name} size="small" />} trailing={<View style={styles.recognitionTrailing}><Badge label={cat.label} tone="gold" /><Avatar name={recognition.to_name} size="small" /></View>} />
                <Text style={styles.message}>“{recognition.message}”</Text>
                {canDelete ? <View style={styles.recognitionActions}><Button label="Remover" icon="trash-outline" variant="danger" onPress={() => handleDelete(recognition)} /></View> : null}
              </Card>
            );
          })}</View></Section>
        )}
      </ScrollView>

      <Modal visible={modalOpen} title={step === 'pick' ? 'Quem você quer reconhecer?' : `Reconhecer ${selectedEmp?.name.split(' ')[0]}`} subtitle={step === 'pick' ? 'Escolha uma pessoa da equipe.' : 'Escreva uma mensagem objetiva e específica.'} onClose={() => setModalOpen(false)} footer={step === 'write' ? <View style={styles.modalActions}><Button label="Escolher outra pessoa" variant="secondary" onPress={() => setStep('pick')} style={styles.actionButton} /><Button label="Publicar reconhecimento" icon="trophy-outline" loading={saving} disabled={!message.trim()} onPress={handleSave} style={styles.actionButton} /></View> : undefined}>
        <KeyboardAvoidingView behavior="padding"><ScrollView style={styles.modalScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {step === 'pick' ? <><Input label="Buscar colaborador" placeholder="Nome ou cargo" value={empSearch} onChangeText={setEmpSearch} autoFocus />{filteredEmps.length === 0 ? <EmptyState icon="people-outline" title="Nenhum colaborador encontrado" description="Tente outro nome ou cargo." /> : <Card padded={false}>{filteredEmps.map((employee) => <ListRow key={employee.id} title={employee.name} description={employee.role_title} leading={<Avatar name={employee.name} size="small" />} trailing={<Ionicons name="chevron-forward" size={tamanho.iconeMedio} color={cores.texto.discreto} />} onPress={() => { setSelectedEmp(employee); setStep('write'); }} accessibilityLabel={`Reconhecer ${employee.name}`} />)}</Card>}</> : <><Section title="Categoria"><View style={styles.categoryOptions}>{CATEGORIES.map(([key, value]) => <Button key={key} label={value.label} icon={value.icon as keyof typeof Ionicons.glyphMap} variant={category === key ? 'primary' : 'secondary'} onPress={() => setCategory(key)} />)}</View></Section><Input label="Mensagem" placeholder={`Escreva o que ${selectedEmp?.name.split(' ')[0]} fez de especial`} value={message} onChangeText={setMessage} multiline maxLength={500} numberOfLines={4} inputStyle={styles.messageInput} autoFocus /><Text style={styles.characterCount}>{message.length}/500</Text></>}
        </ScrollView></KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  loadingContent: { gap: espaco.lg, padding: espaco.xl },
  recognitionList: { gap: espaco.sm },
  recognitionTrailing: { alignItems: 'flex-end', flexDirection: 'row', gap: espaco.xs },
  message: { ...tipografia.corpo, color: cores.texto.secundario, fontStyle: 'italic', marginHorizontal: espaco.md, marginBottom: espaco.md },
  recognitionActions: { alignItems: 'flex-end', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, padding: espaco.md },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  messageInput: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  characterCount: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
  actionButton: { flex: 1 },
});
