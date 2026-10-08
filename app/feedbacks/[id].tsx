import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { confirmarSalvo } from '../../helpers/confirmacaoSalvo';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BotaoWhatsApp } from '../../componentes/BotaoWhatsApp';
import { Button } from '../../componentes/Button';
import { EmptyState } from '../../componentes/EmptyState';
import { FeedbackForm } from '../../componentes/FeedbackForm';
import { Skeleton } from '../../componentes/Skeleton';
import { deleteFeedback, feedbackPdfUrl, feedbackPublicUrl, getFeedback, publishFeedback, revokeFeedback, updateFeedback } from '../../conexoes/feedbacks';
import { getEmployeeById } from '../../conexoes/colaboradores';
import { atualizarCache, gravarCache, lerCache } from '../../helpers/cacheDados';
import { chaves } from '../../helpers/chavesCache';
import { textoExclusaoFeedback } from '../../helpers/feedback';
import { mensagemFeedback, normalizarTelefoneWhatsapp } from '../../helpers/whatsapp';
import { confirmAction } from '../../helpers/confirm';
import { useToast } from '../../contextos/Toast';
import type { CreateFeedbackData, Feedback } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

function idFromParam(value: string | string[] | undefined): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function dateTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function employeeMeta(feedback: Feedback): string {
  return [feedback.employee_role_title, feedback.employee_department_name].filter(Boolean).join(' · ') || 'Colaborador';
}

function statusInfo(feedback: Feedback) {
  if (feedback.status === 'acknowledged') return { label: 'Leitura confirmada', color: cores.status.sucesso.forte };
  if (feedback.status === 'published') return { label: 'Aguardando leitura', color: cores.status.pendente.forte };
  if (feedback.status === 'revoked') return { label: 'Acesso revogado', color: cores.status.erro.forte };
  return { label: 'Rascunho', color: cores.texto.discreto };
}

export default function FeedbackDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = idFromParam(rawId);
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [form, setForm] = useState<CreateFeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Telefone do colaborador (opcional): com ele o WhatsApp já abre a conversa certa.
  const [telefone, setTelefone] = useState<string | null>(null);
  const [error, setError] = useState('');
  const narrow = width < 560;

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const item = await getFeedback(id);
      setFeedback(item);
      setForm({ employee_id: item.employee_id, title: item.title, content: item.content });
    } catch (reason: any) { setError(reason?.message ?? 'Não foi possível carregar o feedback.'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!feedback?.employee_id || feedback.status === 'draft') return;
    let ativo = true;
    getEmployeeById(feedback.employee_id).then((e) => { if (ativo) setTelefone(e.phone ?? null); }).catch(() => { /* sem telefone: cai no wa.me sem número */ });
    return () => { ativo = false; };
  }, [feedback?.employee_id, feedback?.status]);

  async function saveDraft() {
    if (!id || !form || !form.employee_id || !form.title.trim() || !form.content.trim()) return toast.warning('Preencha colaborador, título e texto do feedback.');
    setSaving(true);
    try {
      const updated = await updateFeedback(id, { ...form, title: form.title.trim(), content: form.content.trim() });
      setFeedback((current) => current ? { ...current, ...updated } : updated);
      setForm({ employee_id: updated.employee_id, title: updated.title, content: updated.content });
      toast.success('Rascunho salvo.');
      await confirmarSalvo();
    } catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível salvar o rascunho.'); } finally { setSaving(false); }
  }

  function publish() {
    if (!id) return;
    confirmAction('Publicar feedback', 'Um link privado e permanente será criado para o colaborador. Depois será possível copiar o link, acompanhar a leitura, baixar o PDF e revogar o acesso.\n\nDeseja publicar?', async () => {
      setSaving(true);
      try {
        const published = await publishFeedback(id);
        setFeedback((current) => current ? { ...current, ...published } : published);
        toast.success('Feedback publicado. Copie o link para compartilhar.');
        await confirmarSalvo();
      } catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível publicar o feedback.'); }
      finally { setSaving(false); }
    });
  }

  function revoke() {
    if (!id) return;
    confirmAction('Revogar acesso', 'O link deixará de funcionar imediatamente e não poderá ser reativado. Deseja revogar?', async () => {
      setSaving(true);
      try {
        const revoked = await revokeFeedback(id);
        setFeedback((current) => current ? { ...current, ...revoked } : revoked);
        setMoreOpen(false);
        toast.success('Acesso revogado.');
      } catch (reason: any) { toast.error(reason?.message ?? 'Não foi possível revogar o link.'); }
      finally { setSaving(false); }
    });
  }

  function remove() {
    if (!id || !feedback) return;
    const aviso = textoExclusaoFeedback(feedback.status);
    confirmAction(aviso.titulo, aviso.mensagem, async () => {
      // Otimista: o feedback sai da lista e a tela já volta para ela; se a API recusar, a lista volta ao que era e avisa.
      const chave = chaves.feedbacks;
      const anterior = lerCache<Feedback[]>(chave);
      atualizarCache<Feedback[]>(chave, (lista) => lista.filter((x) => x.id !== id));
      router.replace('/feedbacks' as never);
      try {
        await deleteFeedback(id);
        toast.success('Feedback excluído.');
      } catch (reason: any) {
        if (anterior) gravarCache(chave, anterior.dados, anterior.atualizadoEm);
        toast.error(reason?.message ?? 'Não foi possível excluir o feedback.');
      }
    });
  }

  async function copyLink(token: string) {
    await Clipboard.setStringAsync(feedbackPublicUrl(token));
    toast.success('Link copiado.');
  }

  async function openUrl(url: string) {
    try { await Linking.openURL(url); } catch { toast.error('Não foi possível abrir o link.'); }
  }

  if (!id) return <EmptyState icon="alert-circle-outline" title="Feedback inválido" description="O identificador do feedback não é válido." />;
  if (loading) return <View style={styles.loading}><Skeleton accessibilityLabel="Carregando feedback" style={styles.loadingSkeleton} /></View>;
  if (error || !feedback || !form) return <EmptyState icon="alert-circle-outline" title="Não foi possível abrir o feedback" description={error || 'Feedback não encontrado.'} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} />;

  const activeToken = feedback.public_token && feedback.status !== 'revoked' ? feedback.public_token : null;
  const status = statusInfo(feedback);
  const isDraft = feedback.status === 'draft';
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.page}>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/feedbacks' as never)} style={styles.back}><Ionicons color={cores.texto.secundario} name="arrow-back" size={tamanho.iconePequeno} /><Text style={styles.backText}>Feedbacks</Text></Pressable>
        {isDraft ? (
          <>
            <View style={styles.intro}><Text accessibilityRole="header" style={styles.heading}>Revisar rascunho</Text><Text style={styles.subtitle}>O colaborador só terá acesso após a publicação.</Text></View>
            <View style={styles.formArea}><FeedbackForm disabled={saving} onChange={setForm} value={form} /></View>
            <View style={[styles.draftActions, narrow && styles.draftActionsNarrow]}>
              <Button accessibilityLabel="Excluir rascunho" disabled={saving} icon="trash-outline" label="Excluir rascunho" onPress={remove} style={narrow ? styles.fullAction : undefined} variant="danger" />
              <Button disabled={saving} label="Salvar rascunho" loading={saving} onPress={saveDraft} style={narrow ? styles.fullAction : undefined} variant="secondary" />
              <Button disabled={saving} icon="send-outline" label="Publicar feedback" loading={saving} onPress={publish} style={narrow ? styles.fullAction : undefined} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.titleRow}><View style={styles.titleCopy}><Text accessibilityRole="header" style={styles.heading}>{feedback.title}</Text><View style={styles.employeeBlock}><Text style={styles.employeeName}>{feedback.employee_name ?? 'Colaborador'}</Text><Text style={styles.employeeMeta}>{employeeMeta(feedback)}</Text></View></View><View style={styles.status}><View style={[styles.dot, { backgroundColor: status.color }]} /><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View></View>
            {feedback.status === 'acknowledged' && feedback.acknowledged_at ? <View style={styles.acknowledged}><Ionicons color={cores.status.sucesso.forte} name="checkmark" size={tamanho.iconePequeno} /><View><Text style={styles.acknowledgedTitle}>Leitura confirmada</Text><Text style={styles.acknowledgedText}>{feedback.employee_name ?? 'O colaborador'} confirmou a leitura em {dateTime(feedback.acknowledged_at)}.</Text></View></View> : null}
            {feedback.status === 'acknowledged' && feedback.acknowledgment_note ? <View accessibilityLabel="Observação do colaborador" style={styles.note}><Text style={styles.noteLabel}>Observação do colaborador</Text><Text selectable style={styles.noteText}>{feedback.acknowledgment_note}</Text></View> : null}
            {feedback.status === 'revoked' ? <View style={styles.revoked}><Text style={styles.revokedTitle}>Acesso revogado</Text><Text style={styles.revokedText}>Este link foi revogado em {dateTime(feedback.revoked_at)} e não pode mais ser acessado.</Text></View> : null}
            <View style={styles.rule} />
            <Text style={styles.body}>{feedback.content}</Text>
            <View style={styles.rule} />
            <View style={styles.author}><Text style={styles.authorName}>{feedback.created_by_name || 'Recursos Humanos'}</Text><Text style={styles.authorMeta}>Publicado em {dateTime(feedback.published_at)}</Text></View>
            {activeToken ? <><View style={styles.sectionRule} /><Text style={styles.sectionLabel}>Link do colaborador</Text><Text selectable numberOfLines={1} style={styles.link}>{feedbackPublicUrl(activeToken)}</Text>{normalizarTelefoneWhatsapp(telefone) ? <Text style={styles.documentHint}>WhatsApp do colaborador: {telefone}</Text> : null}<View style={[styles.linkActions, narrow && styles.linkActionsNarrow]}><Button icon="copy-outline" label="Copiar link" onPress={() => copyLink(activeToken)} style={narrow ? styles.fullAction : undefined} variant="secondary" /><BotaoWhatsApp mensagem={mensagemFeedback(feedback.employee_name, feedbackPublicUrl(activeToken))} style={narrow ? styles.fullAction : undefined} telefone={telefone} variant="secondary" /><Button icon="eye-outline" label="Abrir como colaborador" onPress={() => openUrl(feedbackPublicUrl(activeToken))} style={narrow ? styles.fullAction : undefined} variant="ghost" /></View><View style={styles.documentRow}><View><Text style={styles.documentTitle}>Documento</Text><Text style={styles.documentHint}>Versão para download e arquivo.</Text></View><Button icon="download-outline" label="Baixar PDF" onPress={() => openUrl(feedbackPdfUrl(activeToken))} variant="secondary" /></View></> : null}
            <View style={styles.moreWrap}><Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((open) => !open)} style={styles.moreButton}><Ionicons color={cores.texto.secundario} name="ellipsis-horizontal" size={tamanho.iconeMedio} /><Text style={styles.moreText}>Mais ações</Text></Pressable>{moreOpen ? <View style={styles.moreMenu}>{activeToken ? <Pressable accessibilityRole="button" disabled={saving} onPress={revoke} style={styles.revokeAction}><Text style={styles.revokeActionText}>Revogar acesso</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={remove} style={styles.revokeAction}><Text style={styles.revokeActionText}>Excluir feedback</Text></Pressable></View> : null}</View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: espaco.xl, paddingBottom: espaco.secao },
  page: { alignSelf: 'center', maxWidth: 760, width: '100%' },
  loading: { padding: espaco.xl },
  loadingSkeleton: { height: espaco.secao },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: espaco.sm, minHeight: tamanho.toqueMinimo, marginBottom: espaco.xl },
  backText: { ...tipografia.corpoForte, color: cores.texto.secundario },
  intro: { marginBottom: espaco.xxxl },
  heading: { ...tipografia.display, color: cores.texto.primario },
  subtitle: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.xs },
  formArea: { borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, paddingBottom: espaco.xxxl },
  draftActions: { flexDirection: 'row', gap: espaco.md, justifyContent: 'flex-end', marginTop: espaco.xl },
  draftActionsNarrow: { flexDirection: 'column-reverse' },
  fullAction: { width: '100%' },
  titleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.lg, justifyContent: 'space-between' },
  titleCopy: { flex: 1 },
  employeeBlock: { marginTop: espaco.lg },
  employeeName: { ...tipografia.corpoForte, color: cores.texto.primario },
  employeeMeta: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.micro },
  status: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm },
  dot: { borderRadius: raio.pill, height: tamanho.indicador, width: tamanho.indicador },
  statusText: { ...tipografia.corpoForte },
  note: { backgroundColor: cores.superficie.sutil, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, gap: espaco.xs, marginTop: espaco.lg, padding: espaco.md },
  noteLabel: { ...tipografia.rotulo, color: cores.texto.discreto, textTransform: 'uppercase' },
  noteText: { ...tipografia.corpo, color: cores.texto.primario },
  acknowledged: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.sm, marginTop: espaco.xxl },
  acknowledgedTitle: { ...tipografia.corpoForte, color: cores.status.sucesso.forte },
  acknowledgedText: { ...tipografia.corpo, color: cores.texto.secundario, marginTop: espaco.micro },
  revoked: { marginTop: espaco.xxl },
  revokedTitle: { ...tipografia.corpoForte, color: cores.status.erro.forte },
  revokedText: { ...tipografia.corpo, color: cores.texto.secundario, marginTop: espaco.micro },
  rule: { backgroundColor: cores.borda.sutil, height: borda.fina, marginVertical: espaco.xxl },
  body: { ...tipografia.corpo, color: cores.texto.primario, fontSize: 16, lineHeight: 28 },
  author: { gap: espaco.micro },
  authorName: { ...tipografia.corpoForte, color: cores.texto.primario },
  authorMeta: { ...tipografia.legenda, color: cores.texto.discreto },
  sectionRule: { backgroundColor: cores.borda.sutil, height: borda.fina, marginTop: espaco.xxxl, marginBottom: espaco.xl },
  sectionLabel: { ...tipografia.rotulo, color: cores.texto.discreto, textTransform: 'uppercase' },
  link: { ...tipografia.corpo, color: cores.accent.douradoProfundo, marginTop: espaco.sm },
  linkActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md, marginTop: espaco.lg },
  linkActionsNarrow: { alignItems: 'stretch', flexDirection: 'column' },
  documentRow: { alignItems: 'center', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', justifyContent: 'space-between', marginTop: espaco.xxl, paddingTop: espaco.xl },
  documentTitle: { ...tipografia.corpoForte, color: cores.texto.primario },
  documentHint: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
  moreWrap: { alignItems: 'flex-end', marginTop: espaco.xxl },
  moreButton: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.sm },
  moreText: { ...tipografia.corpoForte, color: cores.texto.secundario },
  moreMenu: { alignSelf: 'flex-end', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, marginTop: espaco.xs },
  revokeAction: { minHeight: tamanho.toqueMinimo, justifyContent: 'center', paddingHorizontal: espaco.lg },
  revokeActionText: { ...tipografia.corpoForte, color: cores.status.erro.forte },
});
