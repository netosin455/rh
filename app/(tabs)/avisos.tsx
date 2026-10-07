// ============================================================
// app/(tabs)/avisos.tsx — Mural de Avisos
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Revelar } from '../../componentes/Revelar';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contextos/Autenticacao';
import { getNotices, createNotice, pinNotice, deleteNotice } from '../../conexoes/avisos';
import { Notice, CreateNoticeData, NoticePriority, NOTICE_PRIORITY_LABELS } from '../../tipos/modelos';
import { useToast } from '../../contextos/Toast';
import { usarDados } from '../../contextos/usarDados';
import { chaves } from '../../helpers/chavesCache';
import { AvisoDesatualizado } from '../../componentes/AvisoDesatualizado';
import { EntradaItem } from '../../componentes/EntradaItem';
import { usarRevelacao } from '../../contextos/usarRevelacao';
import { cores } from '../../estilo/cores';
import { confirmAction } from '../../helpers/confirm';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { DateField } from '../../componentes/DateField';
import { EmptyState } from '../../componentes/EmptyState';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { Input } from '../../componentes/Input';
import { ListRow } from '../../componentes/ListRow';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Section } from '../../componentes/Section';
import { EsqueletoCabecalho, EsqueletoCartaoTexto, EsqueletoGrupo, EsqueletoSecao } from '../../componentes/Esqueletos';

import { borda, espaco, largura, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const priorityTone: Record<NoticePriority, 'gold' | 'danger' | 'info'> = {
  normal: 'info',
  importante: 'gold',
  urgente: 'danger',
};

const PRIORITY_ICONS: Record<NoticePriority, keyof typeof Ionicons.glyphMap> = {
  normal:     'information-circle-outline',
  importante: 'warning-outline',
  urgente:    'alert-circle-outline',
};

const PRIORITY_OPTIONS: { key: NoticePriority; label: string }[] = [
  { key: 'normal',     label: 'Normal' },
  { key: 'importante', label: 'Importante' },
  { key: 'urgente',    label: 'Urgente' },
];

const EMPTY_FORM = {
  title:      '',
  body:       '',
  priority:   'normal' as NoticePriority,
  pinned:     false,
  expires_at: '',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d atrás`;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function AvisosScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  // Dado em cache aparece na hora; a lista é atualizada em segundo plano.
  const { dados, carregando: loading, erro, erroLeve, recarregar, definir: setNotices } = usarDados(chaves.avisos, () => getNotices());
  const notices: Notice[] = dados ?? [];
  const modo = usarRevelacao(loading, dados !== undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [expanded,   setExpanded]   = useState<number | null>(null);
  const [formError,  setFormError]  = useState('');
  const loadError = erro !== null && dados === undefined;

  const onRefresh = useCallback(() => { setRefreshing(true); void recarregar().finally(() => setRefreshing(false)); }, [recarregar]);

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.title.trim()) { setFormError('Informe o título do aviso.'); return; }
    if (!form.body.trim())  { setFormError('Informe o conteúdo do aviso.'); return; }

    setSaving(true);
    try {
      const data: CreateNoticeData = {
        title:      form.title.trim(),
        body:       form.body.trim(),
        priority:   form.priority,
        pinned:     form.pinned,
        expires_at: form.expires_at || undefined,
      };
      const created = await createNotice(data);
      setNotices(prev => [created, ...prev]);
      setShowModal(false);
      toast.success('Aviso publicado para a equipe!');
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePin(n: Notice) {
    try {
      const updated = await pinNotice(n.id, !n.pinned);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, pinned: updated.pinned } : x));
    } catch (e: any) {
      console.error('[handlePin]', e.message);
    }
  }

  function handleDelete(n: Notice) {
    confirmAction('Excluir aviso', `Excluir o aviso "${n.title}"?`, async () => {
      // Otimista: o aviso sai da lista na hora; se a API recusar, volta exatamente como estava.
      const anterior = notices;
      setNotices((prev) => prev.filter((x) => x.id !== n.id));
      try {
        await deleteNotice(n.id);
        toast.success('Aviso excluído.');
      } catch (e: any) {
        console.error('[handleDelete]', e.message);
        setNotices(() => anterior);
        toast.error(e.message || 'Não foi possível excluir o aviso.');
      }
    });
  }

  // Esqueleto com o desenho do conteúdo: cabeçalho e cartões de aviso (linha + texto + rodapé).
  const esqueleto = (
    <EsqueletoGrupo rotulo="Carregando avisos" style={styles.loadingContent}>
      <EsqueletoCabecalho larguraSubtitulo="56%" larguraTitulo="22%" />
      <EsqueletoSecao descricao largura="24%">
        <View style={styles.noticeList}>
          {[0, 1, 2].map((i) => <EsqueletoCartaoTexto alturaMinima={166} key={i} />)}
        </View>
      </EsqueletoSecao>
    </EsqueletoGrupo>
  );

  const pinned   = notices.filter(n => n.pinned);
  const unpinned = notices.filter(n => !n.pinned);

  const principal = (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader title="Avisos" subtitle="Comunicados para manter toda a equipe informada." action={canManage ? <Button label="Novo aviso" icon="add" onPress={openModal} /> : undefined} />
        <AvisoDesatualizado visivel={erroLeve} />
        {loadError ? <ErroComRetry mensagem="Não foi possível carregar os avisos." onTentarNovamente={onRefresh} carregando={refreshing} /> : null}
        {notices.length === 0 && !loadError ? (
          <Card><EmptyState icon="megaphone-outline" title="Nenhum aviso publicado" description={canManage ? 'Publique o primeiro aviso para a equipe.' : 'Quando houver um comunicado, ele aparecerá aqui.'} action={canManage ? <Button label="Publicar aviso" icon="add" onPress={openModal} /> : undefined} /></Card>
        ) : (
          <>
            {pinned.length > 0 && (
              <Section title="Fixados" description={`${pinned.length} aviso${pinned.length === 1 ? '' : 's'} prioritário${pinned.length === 1 ? '' : 's'}`}><View style={styles.noticeList}>{pinned.map((notice, i) => <EntradaItem indice={i} key={notice.id} modo={modo} total={pinned.length}><NoticeRow notice={notice} expanded={expanded === notice.id} canManage={canManage} onToggle={() => setExpanded((current) => current === notice.id ? null : notice.id)} onPin={() => handlePin(notice)} onDelete={() => handleDelete(notice)} /></EntradaItem>)}</View></Section>
            )}

            {unpinned.length > 0 && (
              <Section title={pinned.length > 0 ? 'Todos os avisos' : 'Avisos'} description={`${unpinned.length} comunicado${unpinned.length === 1 ? '' : 's'} publicado${unpinned.length === 1 ? '' : 's'}`}><View style={styles.noticeList}>{unpinned.map((notice, i) => <EntradaItem indice={i} key={notice.id} modo={modo} total={unpinned.length}><NoticeRow notice={notice} expanded={expanded === notice.id} canManage={canManage} onToggle={() => setExpanded((current) => current === notice.id ? null : notice.id)} onPin={() => handlePin(notice)} onDelete={() => handleDelete(notice)} /></EntradaItem>)}</View></Section>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showModal} title="Novo aviso" subtitle="Publicar para toda a equipe." onClose={() => setShowModal(false)} footer={<View style={styles.modalActions}><Button label="Cancelar" variant="secondary" onPress={() => setShowModal(false)} style={styles.actionButton} /><Button label="Publicar aviso" loading={saving} onPress={handleSave} style={styles.actionButton} /></View>}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Input label="Título" placeholder="Assunto do aviso" value={form.title} onChangeText={(value) => setF('title', value)} error={formError && !form.title.trim() ? formError : undefined} />
          <Input label="Conteúdo" placeholder="Escreva o aviso aqui" value={form.body} onChangeText={(value) => setF('body', value)} multiline numberOfLines={4} inputStyle={styles.textarea} error={formError && !form.body.trim() ? formError : undefined} />
          <Section title="Prioridade"><View style={styles.optionGroup}>{PRIORITY_OPTIONS.map((option) => <Button key={option.key} label={option.label} icon={PRIORITY_ICONS[option.key]} variant={form.priority === option.key ? 'primary' : 'secondary'} accessibilityLabel={`Prioridade ${option.label}`} onPress={() => setF('priority', option.key)} />)}</View></Section>
          <Section title="Opções"><Button label={form.pinned ? 'Fixado no topo' : 'Fixar no topo'} icon={form.pinned ? 'pin' : 'pin-outline'} variant={form.pinned ? 'primary' : 'secondary'} onPress={() => setF('pinned', !form.pinned)} /></Section>
          <DateField hint="Deixe em branco para o aviso não expirar." label="Válido até" onChange={(iso) => setF('expires_at', iso)} value={form.expires_at} />
          {formError ? <Card style={styles.errorCard}><View style={styles.errorContent}><Ionicons name="alert-circle-outline" size={tamanho.iconeMedio} color={cores.status.erro.forte} /><Text style={styles.errorText}>{formError}</Text></View></Card> : null}
        </ScrollView></KeyboardAvoidingView>
      </Modal>
    </View>
  );
  return (
    <Revelar carregando={loading} esqueleto={esqueleto}>
      {principal}
    </Revelar>
  );
}

function NoticeRow({
  notice, expanded, canManage, onToggle, onPin, onDelete,
}: {
  notice: Notice; expanded: boolean;
  canManage: boolean; onToggle: () => void; onPin: () => void; onDelete: () => void;
}) {
  return (
    <Card padded={false} style={notice.priority === 'urgente' ? styles.urgentNotice : undefined}>
      <ListRow
        title={notice.title}
        description={`${NOTICE_PRIORITY_LABELS[notice.priority]} · ${notice.author_name ?? 'RH'} · ${timeAgo(notice.created_at)}`}
        leading={<View style={styles.priorityIcon}><Ionicons name={PRIORITY_ICONS[notice.priority]} size={tamanho.iconeMedio} color={notice.priority === 'urgente' ? cores.status.erro.forte : notice.priority === 'importante' ? cores.accent.douradoProfundo : cores.status.informacao.forte} /></View>}
        trailing={<View style={styles.noticeTrailing}><Badge label={NOTICE_PRIORITY_LABELS[notice.priority]} tone={priorityTone[notice.priority]} />{notice.pinned ? <Ionicons name="pin" size={tamanho.iconePequeno} color={cores.accent.douradoProfundo} /> : null}</View>}
        onPress={onToggle}
        accessibilityLabel={`${expanded ? 'Recolher' : 'Expandir'} aviso: ${notice.title}`}
      />
      <Text numberOfLines={expanded ? undefined : 2} style={styles.noticeBody}>{notice.body}</Text>
      <View style={styles.noticeFooter}>
        <Text style={styles.expandHint}>{expanded ? 'Recolher' : 'Ler mais'}</Text>
        {canManage ? <View style={styles.noticeActions}><Button label={notice.pinned ? 'Desafixar' : 'Fixar'} icon={notice.pinned ? 'pin' : 'pin-outline'} variant="ghost" onPress={onPin} /><Button label="Excluir" icon="trash-outline" variant="danger" onPress={onDelete} /></View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  loadingContent: { gap: espaco.secao, padding: espaco.xl },
  noticeList: { gap: espaco.sm },
  urgentNotice: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  priorityIcon: { alignItems: 'center', backgroundColor: cores.superficie.sutil, borderRadius: raio.pill, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  noticeTrailing: { alignItems: 'flex-end', gap: espaco.xs },
  noticeBody: { ...tipografia.corpo, color: cores.texto.secundario, marginHorizontal: espaco.md, marginBottom: espaco.md },
  noticeFooter: { alignItems: 'center', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between', padding: espaco.md },
  expandHint: { ...tipografia.legenda, color: cores.texto.accentSobreClaro },
  noticeActions: { flexDirection: 'row', gap: espaco.xs },
  modalScroll: { maxHeight: largura.leitura },
  formContent: { gap: espaco.xxl },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  textarea: { minHeight: tamanho.toqueMinimo * 2, textAlignVertical: 'top' },
  errorCard: { backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda },
  errorContent: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  errorText: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
  modalActions: { flexDirection: 'row', gap: espaco.sm },
  actionButton: { flex: 1 },
});
