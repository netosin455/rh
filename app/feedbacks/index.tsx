import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { BotaoWhatsApp } from '../../componentes/BotaoWhatsApp';
import { Button } from '../../componentes/Button';
import { EmptyState } from '../../componentes/EmptyState';
import { Input } from '../../componentes/Input';
import { Skeleton } from '../../componentes/Skeleton';
import { feedbackPdfUrl, feedbackPublicUrl, getFeedbacks } from '../../conexoes/feedbacks';
import { useAuth } from '../../contextos/Autenticacao';
import { normalizarTexto } from '../../helpers/buscaColaborador';
import { mensagemFeedback } from '../../helpers/whatsapp';
import { useToast } from '../../contextos/Toast';
import type { Feedback, FeedbackStatus } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';

const RH_ROLES = ['super_admin', 'admin', 'rh', 'adm'];
type Filter = 'all' | 'published' | 'acknowledged';

function statusCopy(status: FeedbackStatus) {
  if (status === 'acknowledged') return { label: 'Confirmado', color: cores.status.sucesso.forte };
  if (status === 'published') return { label: 'Aguardando leitura', color: cores.status.pendente.forte };
  if (status === 'revoked') return { label: 'Revogado', color: cores.status.erro.forte };
  return { label: 'Rascunho', color: cores.texto.discreto };
}

function shortDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value)).replace('.', '') : '—';
}

function dateTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)).replace('.', '') : '—';
}

function FeedbackState({ feedback }: { feedback: Feedback }) {
  const state = statusCopy(feedback.status);
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.dot, { backgroundColor: state.color }]} />
      <View style={styles.stateCopy}>
        <Text style={[styles.stateLabel, { color: state.color }]}>{state.label}</Text>
        {feedback.acknowledged_at ? <Text style={styles.stateTime}>{dateTime(feedback.acknowledged_at)}</Text> : null}
        {feedback.acknowledgment_note ? (
          <View accessibilityLabel="Com observação do colaborador" style={styles.noteTag}>
            <Ionicons color={cores.accent.douradoProfundo} name="chatbubble-ellipses-outline" size={tamanho.iconePequeno} />
            <Text style={styles.noteTagText}>com observação</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FeedbackRow({ feedback, wide, onOpen, onCopy, onPdf, onManage }: {
  feedback: Feedback;
  wide: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onPdf: () => void;
  onManage: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Foco de teclado também revela as ações (quem navega com Tab precisa vê-las).
  const [focusedInside, setFocusedInside] = useState(false);
  const showActions = hovered || focusedInside || !wide;
  const canShare = Boolean(feedback.public_token && feedback.status !== 'revoked');
  const employeeMeta = [feedback.employee_role_title, feedback.employee_department_name].filter(Boolean).join(' · ');

  return (
    // View + onPointerEnter/Leave (semântica do DOM: não dispara ao passar entre filhos).
    // O onHoverIn/Out do Pressable "piscava" a cada troca de filho sob o cursor.
    <View
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={[styles.row, hovered && styles.rowHovered, !wide && styles.rowNarrow]}
    >
      <View style={[styles.personColumn, !wide && styles.narrowMain]}>
        <View style={styles.personMark}><Text style={styles.personInitial}>{(feedback.employee_name ?? 'C').slice(0, 1).toLocaleUpperCase('pt-BR')}</Text></View>
        <View style={styles.personCopy}><Text style={styles.employeeName}>{feedback.employee_name ?? 'Colaborador'}</Text><Text numberOfLines={1} style={styles.employeeMeta}>{employeeMeta || 'Colaborador'}</Text></View>
      </View>
      <View style={[styles.titleColumn, !wide && styles.narrowTitle]}><Text numberOfLines={2} style={styles.title}>{feedback.title}</Text></View>
      <Text style={[styles.dateColumn, !wide && styles.dateNarrow]}>{shortDate(feedback.published_at ?? feedback.created_at)}</Text>
      <FeedbackState feedback={feedback} />
      {/* Sempre montado e SEM pointerEvents alternando: se o hover controlasse quem recebe o mouse,
          a caixa sumiria sob o cursor, o hover cairia e voltaria em loop (a linha "tremia"). Só a opacidade muda. */}
      <View
        onBlur={() => setFocusedInside(false)}
        onFocus={() => setFocusedInside(true)}
        style={[styles.rowActions, !wide && styles.rowActionsNarrow, !showActions && styles.rowActionsHidden]}
      >
        <Button icon="eye-outline" label="Abrir" onPress={onOpen} variant="ghost" />
        {canShare ? <Button icon="copy-outline" label="Copiar link" onPress={onCopy} variant="ghost" /> : null}
        {canShare && feedback.public_token ? <BotaoWhatsApp accessibilityLabel={`Enviar no WhatsApp: ${feedback.title}`} mensagem={mensagemFeedback(feedback.employee_name, feedbackPublicUrl(feedback.public_token))} /> : null}
        <Button icon="ellipsis-horizontal" label="Mais" onPress={onManage} variant="ghost" />
        {canShare ? <Button accessibilityLabel="Baixar PDF" icon="download-outline" onPress={onPdf} variant="ghost" /> : null}
      </View>
    </View>
  );
}

export default function FeedbacksScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const canManage = RH_ROLES.includes(user?.role ?? '');
  const wide = width >= 760;

  const load = useCallback(async () => {
    setError('');
    try { setFeedbacks(await getFeedbacks()); } catch (reason: any) { setError(reason?.message ?? 'Não foi possível carregar feedbacks.'); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: feedbacks.length,
    published: feedbacks.filter((item) => item.status === 'published').length,
    acknowledged: feedbacks.filter((item) => item.status === 'acknowledged').length,
  }), [feedbacks]);
  const visibleFeedbacks = useMemo(() => {
    // Sem diferenciar acento nem maiúsculas ("cárla" acha "Carla").
    const normalized = normalizarTexto(query);
    return feedbacks.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter;
      const matchesQuery = !normalized || normalizarTexto(`${item.employee_name ?? ''} ${item.title}`).includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [feedbacks, filter, query]);

  async function copyLink(feedback: Feedback) {
    if (!feedback.public_token) return;
    await Clipboard.setStringAsync(feedbackPublicUrl(feedback.public_token));
    toast.success('Link copiado.');
  }

  async function openUrl(url: string) {
    try { await Linking.openURL(url); } catch { toast.error('Não foi possível abrir o link.'); }
  }

  if (!canManage) return <EmptyState icon="lock-closed-outline" title="Acesso restrito" description="Apenas RH e administradores podem gerenciar feedbacks." />;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={cores.accent.dourado} />}>
      <View style={[styles.page, !wide && styles.pageNarrow]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text accessibilityRole="header" style={styles.heading}>Feedbacks</Text><Text style={styles.subtitle}>Envie feedbacks individuais e acompanhe a leitura.</Text></View>
          <Button icon="add-outline" label="Novo feedback" onPress={() => router.push('/feedbacks/novo' as never)} />
        </View>

        <View style={[styles.toolbar, !wide && styles.toolbarNarrow]}>
          <Input containerStyle={styles.search} label="Buscar colaborador" onChangeText={setQuery} placeholder="Buscar colaborador..." value={query} />
        </View>
        <View accessibilityRole="tablist" style={styles.filters}>
          {([
            ['all', 'Todos'],
            ['published', 'Aguardando'],
            ['acknowledged', 'Confirmados'],
          ] as [Filter, string][]).map(([value, label]) => (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}>
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label} <Text style={styles.filterCount}>{counts[value]}</Text></Text>
            </Pressable>
          ))}
        </View>

        {loading ? <View style={styles.loadingList}><Skeleton accessibilityLabel="Carregando feedbacks" style={styles.skeleton} /><Skeleton accessibilityLabel="Carregando feedbacks" style={styles.skeleton} /><Skeleton accessibilityLabel="Carregando feedbacks" style={styles.skeleton} /></View> : null}
        {!loading && error ? <EmptyState icon="alert-circle-outline" title="Não foi possível carregar feedbacks" description={error} action={<Button icon="refresh-outline" label="Tentar novamente" onPress={load} />} /> : null}
        {!loading && !error && !feedbacks.length ? <EmptyState icon="chatbox-ellipses-outline" title="Nenhum feedback criado" description="Crie um rascunho para começar." action={<Button icon="add-outline" label="Novo feedback" onPress={() => router.push('/feedbacks/novo' as never)} />} /> : null}
        {!loading && !error && feedbacks.length ? (
          <View style={styles.table}>
            {wide ? <View style={styles.tableHeader}><Text style={[styles.columnLabel, styles.personHeader]}>Colaborador</Text><Text style={[styles.columnLabel, styles.titleHeader]}>Feedback</Text><Text style={[styles.columnLabel, styles.dateHeader]}>Enviado</Text><Text style={[styles.columnLabel, styles.statusHeader]}>Status</Text></View> : null}
            {visibleFeedbacks.map((feedback) => (
              <FeedbackRow
                feedback={feedback}
                key={feedback.id}
                onCopy={() => copyLink(feedback)}
                onManage={() => router.push(`/feedbacks/${feedback.id}` as never)}
                onOpen={() => feedback.public_token && feedback.status !== 'revoked' ? openUrl(feedbackPublicUrl(feedback.public_token)) : router.push(`/feedbacks/${feedback.id}` as never)}
                onPdf={() => feedback.public_token ? openUrl(feedbackPdfUrl(feedback.public_token)) : undefined}
                wide={wide}
              />
            ))}
            {!visibleFeedbacks.length ? <View style={styles.noResults}><Text style={styles.noResultsText}>Nenhum feedback encontrado para este filtro.</Text></View> : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: espaco.xl, paddingBottom: espaco.secao },
  page: { alignSelf: 'center', maxWidth: 1180, width: '100%' },
  pageNarrow: { maxWidth: 680 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.lg, justifyContent: 'space-between', marginBottom: espaco.xxxl },
  headerCopy: { flex: 1 },
  heading: { ...tipografia.display, color: cores.texto.primario },
  subtitle: { ...tipografia.corpo, color: cores.texto.discreto, marginTop: espaco.xs },
  toolbar: { marginBottom: espaco.md, maxWidth: 360 },
  toolbarNarrow: { maxWidth: undefined },
  search: { width: '100%' },
  filters: { alignItems: 'center', borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', gap: espaco.xl, marginBottom: espaco.xs },
  filter: { borderBottomColor: 'transparent', borderBottomWidth: borda.foco, paddingBottom: espaco.md },
  filterActive: { borderBottomColor: cores.accent.dourado },
  filterText: { ...tipografia.corpoForte, color: cores.texto.discreto },
  filterTextActive: { color: cores.texto.primario },
  filterCount: { ...tipografia.legenda, color: cores.texto.discreto },
  loadingList: { marginTop: espaco.md },
  skeleton: { height: tamanho.toqueMinimo + espaco.xxl, marginBottom: borda.fina },
  table: { marginTop: espaco.sm },
  tableHeader: { alignItems: 'center', flexDirection: 'row', minHeight: espaco.xxxl, paddingHorizontal: espaco.md },
  columnLabel: { ...tipografia.rotulo, color: cores.texto.discreto, textTransform: 'uppercase' },
  personHeader: { flex: 1.35 },
  titleHeader: { flex: 1.35 },
  dateHeader: { width: 90 },
  statusHeader: { width: 175 },
  row: { alignItems: 'center', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', minHeight: tamanho.toqueMinimo + espaco.xxl, paddingHorizontal: espaco.md, position: 'relative' },
  rowHovered: { backgroundColor: cores.superficie.elevada },
  rowNarrow: { alignItems: 'flex-start', flexWrap: 'wrap', gap: espaco.md, paddingVertical: espaco.md },
  personColumn: { alignItems: 'center', flex: 1.35, flexDirection: 'row', gap: espaco.md, minWidth: 0 },
  narrowMain: { flexBasis: '100%', flexGrow: 0 },
  personMark: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.pill, borderWidth: borda.fina, height: tamanho.avatarPequeno, justifyContent: 'center', width: tamanho.avatarPequeno },
  personInitial: { ...tipografia.legenda, color: cores.texto.secundario },
  personCopy: { flex: 1, minWidth: 0 },
  employeeName: { ...tipografia.corpoForte, color: cores.texto.primario },
  employeeMeta: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
  titleColumn: { flex: 1.35, minWidth: 0, paddingRight: espaco.md },
  narrowTitle: { flexBasis: '100%', flexGrow: 0 },
  title: { ...tipografia.corpo, color: cores.texto.primario },
  dateColumn: { ...tipografia.legenda, color: cores.texto.discreto, width: 90 },
  dateNarrow: { width: 'auto' },
  stateWrap: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.sm, width: 175 },
  dot: { borderRadius: raio.pill, height: tamanho.indicador, marginTop: espaco.xs, width: tamanho.indicador },
  stateCopy: { flex: 1 },
  stateLabel: { ...tipografia.legenda },
  noteTag: { alignItems: 'center', flexDirection: 'row', gap: espaco.micro, marginTop: espaco.micro },
  noteTagText: { ...tipografia.legenda, color: cores.accent.douradoProfundo },
  stateTime: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
  rowActions: { alignItems: 'center', backgroundColor: cores.superficie.elevada, flexDirection: 'row', gap: espaco.xs, position: 'absolute', right: espaco.sm },
  rowActionsNarrow: { flexBasis: '100%', flexWrap: 'wrap', position: 'relative', right: undefined },
  rowActionsHidden: { opacity: 0 },
  noResults: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, paddingVertical: espaco.xxl },
  noResultsText: { ...tipografia.corpo, color: cores.texto.discreto },
});
