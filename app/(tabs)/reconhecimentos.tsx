// ============================================================
// app/(tabs)/reconhecimentos.tsx — Mural de Reconhecimento
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { EmployeePicker } from '../../componentes/EmployeePicker';
import { EmptyState } from '../../componentes/EmptyState';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { MetricCard } from '../../componentes/MetricCard';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { Skeleton } from '../../componentes/Skeleton';
import { borda, espaco, largura, raio, tamanho } from '../../estilo/espaco';
import { useMotion } from '../../estilo/movimento';
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
  const motion = useMotion();
  const [items,      setItems]      = useState<Recognition[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError,  setLoadError]  = useState(false);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [category,    setCategory]    = useState<RecognitionCategory>('resultado');
  const [message,     setMessage]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [step,        setStep]        = useState<'pick' | 'write'>('pick');
  const [publishFeedbackVisible, setPublishFeedbackVisible] = useState(false);
  const publishFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishFeedbackOpacity = useSharedValue(0);
  const publishFeedbackScale = useSharedValue(motion.reduzMovimento ? 1 : 0.98);

  useEffect(() => () => {
    if (publishFeedbackTimer.current) clearTimeout(publishFeedbackTimer.current);
  }, []);

  function showPublishFeedback() {
    if (publishFeedbackTimer.current) clearTimeout(publishFeedbackTimer.current);
    setPublishFeedbackVisible(true);

    if (motion.reduzMovimento) {
      publishFeedbackOpacity.value = 1;
      publishFeedbackScale.value = 1;
    } else {
      publishFeedbackOpacity.value = 0;
      publishFeedbackScale.value = 0.98;
      publishFeedbackOpacity.value = withTiming(1, { duration: 220, easing: motion.entrada });
      publishFeedbackScale.value = withTiming(1, { duration: 220, easing: motion.entrada });
    }

    publishFeedbackTimer.current = setTimeout(() => {
      if (motion.reduzMovimento) {
        setPublishFeedbackVisible(false);
        return;
      }

      publishFeedbackOpacity.value = withTiming(0, { duration: motion.duracao('fast'), easing: motion.saida });
      publishFeedbackTimer.current = setTimeout(() => setPublishFeedbackVisible(false), motion.duracao('fast'));
    }, 400);
  }

  const publishFeedbackStyle = useAnimatedStyle(() => ({
    opacity: publishFeedbackOpacity.value,
    transform: [{ scale: publishFeedbackScale.value }],
  }));

  const load = useCallback(async () => {
    try {
      const res = await getRecognitions();
      setItems(res.data);
      setTotal(res.total);
      setLoadError(false);
    } catch (e: any) {
      setLoadError(true);
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
    } catch (e: unknown) {
      console.error('[Reconhecimentos] colaboradores:', e);
      toast.error('Não foi possível carregar os colaboradores. Tente de novo.');
      return;
    }
    setStep('pick');
    setSelectedEmp(null);
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
      showPublishFeedback();
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

  if (loading) {
    return <View style={styles.container}><View style={styles.loadingContent}><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /></View></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader title="Reconhecimentos" subtitle="Celebre contribuições que fortalecem a equipe." action={<Button label="Dar kudos" icon="add" onPress={openModal} />} />
        {publishFeedbackVisible ? (
          <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert" style={publishFeedbackStyle}>
            <Card style={styles.publishFeedback}>
              <Ionicons color={cores.accent.dourado} name="trophy" size={tamanho.iconeMedio} />
              <Text style={styles.publishFeedbackText}>Reconhecimento publicado</Text>
            </Card>
          </Animated.View>
        ) : null}
        {loadError ? <ErroComRetry mensagem="Não foi possível carregar os reconhecimentos." onTentarNovamente={() => { setRefreshing(true); load(); }} carregando={refreshing} /> : null}
        <MetricCard label="Reconhecimentos" value={total} detail="Registrados no mural" />

        {items.length === 0 && !loadError ? (
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
          {step === 'pick' ? <><EmployeePicker autoFocus employees={employees} listarSemBusca maxResultados={50} onSelect={(employee) => { setSelectedEmp(employee); setStep('write'); }} placeholder="Nome ou cargo" /></> : <>{selectedEmp && !selectedEmp.email ? <View style={styles.emailWarning}><Ionicons name="mail-unread-outline" size={tamanho.iconePequeno} color={cores.status.pendente.forte} /><Text style={styles.emailWarningText}>{selectedEmp.name.split(' ')[0]} não tem email cadastrado — o aviso só aparece pra ele(a) quando acessar o SuperRH.</Text></View> : null}<Section title="Categoria"><View style={styles.categoryOptions}>{CATEGORIES.map(([key, value]) => <Button key={key} label={value.label} icon={value.icon as keyof typeof Ionicons.glyphMap} variant={category === key ? 'primary' : 'secondary'} onPress={() => setCategory(key)} />)}</View></Section><Input label="Mensagem" placeholder={`Escreva o que ${selectedEmp?.name.split(' ')[0]} fez de especial`} value={message} onChangeText={setMessage} multiline maxLength={500} numberOfLines={4} inputStyle={styles.messageInput} autoFocus /><Text style={styles.characterCount}>{message.length}/500</Text></>}
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
  publishFeedback: { alignItems: 'center', backgroundColor: cores.accent.superficie, borderColor: cores.accent.borda, flexDirection: 'row', gap: espaco.sm },
  publishFeedbackText: { ...tipografia.corpoForte, color: cores.texto.accentSobreClaro },
  message: { ...tipografia.corpo, color: cores.texto.secundario, fontStyle: 'italic', marginHorizontal: espaco.md, marginBottom: espaco.md },
  recognitionActions: { alignItems: 'flex-end', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, padding: espaco.md },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  messageInput: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  characterCount: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  emailWarning: { alignItems: 'center', backgroundColor: cores.status.pendente.superficie, borderColor: cores.status.pendente.borda, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.md, padding: espaco.md },
  emailWarningText: { ...tipografia.legenda, color: cores.status.pendente.forte, flex: 1 },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
  actionButton: { flex: 1 },
});
