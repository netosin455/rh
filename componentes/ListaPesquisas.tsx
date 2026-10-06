// ============================================================
// componentes/ListaPesquisas.tsx — SuperRH
// Lista de campanhas. Serve às DUAS áreas, sem duplicar código:
//  - "pesquisas": pesquisas de pulso dos colaboradores (audience = employees)
//  - "nps":       campanhas de satisfação do cliente (audience = customers)
// As duas ficam totalmente separadas: cada uma só lista a sua audiência.
// ============================================================

import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getSurveys, linkPublicoPesquisa } from '../conexoes/pesquisas';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { espaco } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';
import { tipografia } from '../estilo/tipografia';
import { AREAS_PESQUISA, AreaPesquisa } from '../helpers/pesquisa';
import { mensagemNps, mensagemPesquisa } from '../helpers/whatsapp';
import type { PulseSurvey } from '../tipos/modelos';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ListRow } from './ListRow';
import { MetricCard } from './MetricCard';
import { BotaoWhatsApp } from './BotaoWhatsApp';
import { QrCodeModal } from './QrCodeModal';
import { useAcoesPesquisa } from './useAcoesPesquisa';
import { ScreenHeader } from './ScreenHeader';
import { Section } from './Section';
import { Skeleton } from './Skeleton';
import { StatusPill } from './StatusPill';

function quantidadePerguntas(s: PulseSurvey): number {
  return s.question_count ?? s.questions?.length ?? 1;
}

function daysLeft(expires_at: string | null | undefined) {
  if (!expires_at) return null;
  const diff = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Encerrada';
  if (diff === 0) return 'Encerra hoje';
  return `${diff}d restante${diff > 1 ? 's' : ''}`;
}

export function ListaPesquisas({ area }: { area: AreaPesquisa }) {
  const cfg = AREAS_PESQUISA[area];
  const cliente = area === 'nps';
  const router = useRouter();
  const toast = useToast();
  const motion = useMotion();
  const [surveys, setSurveys] = useState<PulseSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  // Campanha cujo QR code está aberto (só na área NPS).
  const [qrDe, setQrDe] = useState<PulseSurvey | null>(null);

  const ativas = surveys.filter((s) => !s.expires_at || new Date(s.expires_at) >= new Date()).length;
  const entrando = useMemo(() => FadeIn.duration(motion.duracao('normal')), [motion]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const lista = await getSurveys(cfg.audience);
      // Mesmo que a API ignore o filtro, nunca mistura as duas áreas na tela.
      setSurveys(lista.filter((s) => (s.audience ?? 'employees') === cfg.audience));
    } catch (e: unknown) {
      const message = e instanceof Error && e.message ? e.message : `Não foi possível carregar ${cfg.plural}`;
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cfg.audience, cfg.plural, toast]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); void load(); };

  const { editar, duplicar, encerrarAgora, excluir } = useAcoesPesquisa(area, () => { void load(); });

  async function copiarLink(s: PulseSurvey) {
    await Clipboard.setStringAsync(linkPublicoPesquisa(s.id));
    toast.success('Link copiado. É só colar no WhatsApp ou no e-mail.');
  }

  function compartilhar(s: PulseSurvey) {
    Share.share({ message: `${s.title}\n\nResponda aqui (é anônimo): ${linkPublicoPesquisa(s.id)}` });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.accent.dourado} />}
      >
        <ScreenHeader
          action={<Button accessibilityLabel={cfg.botaoNova} icon="add-outline" label={cfg.botaoNova} onPress={() => router.push(cfg.rotaNova as never)} />}
          subtitle={cfg.subtitulo}
          title={cfg.titulo}
        />

        <MetricCard
          detail={`${surveys.length} ${surveys.length === 1 ? cfg.singular : cfg.plural} ${surveys.length === 1 ? 'criada' : 'criadas'}`}
          indicator={<StatusPill label="Ativas" status="ativo" />}
          label={cfg.metrica}
          value={loading ? '—' : ativas}
        />

        <Section description={cfg.descricaoLista} title={cfg.tituloLista}>
          {loading ? (
            <Card padded={false} style={styles.listCard}>
              <Skeleton accessibilityLabel="Carregando" style={styles.skeleton} />
              <Skeleton accessibilityLabel="Carregando" style={styles.skeleton} />
              <Skeleton accessibilityLabel="Carregando" style={styles.skeleton} />
            </Card>
          ) : loadError ? (
            <EmptyState
              action={<Button icon="refresh-outline" label="Tentar novamente" onPress={() => { void load(); }} />}
              description={loadError}
              icon="alert-circle-outline"
              title={`Não foi possível carregar ${cfg.plural}`}
            />
          ) : surveys.length === 0 ? (
            <EmptyState
              action={<Button icon="add-outline" label={cfg.botaoCriarVazio} onPress={() => router.push(cfg.rotaNova as never)} />}
              description={cfg.descricaoVazio}
              icon="clipboard-outline"
              title={cfg.tituloVazio}
            />
          ) : (
            <View style={styles.surveyList}>
              {surveys.map((survey) => {
                const expired = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
                const responseCount = survey.response_count ?? 0;
                return (
                  <Animated.View entering={entrando} key={survey.id}>
                    <Card padded={false} style={expired ? styles.expiredCard : undefined}>
                      <ListRow
                        accessibilityLabel={`Ver resultados de ${survey.title}`}
                        description={survey.question ?? `${quantidadePerguntas(survey)} perguntas`}
                        onPress={() => router.push(cfg.rotaDetalhe(survey.id) as never)}
                        title={survey.title}
                        trailing={(
                          <View style={styles.rowBadges}>
                            <Badge label={`${quantidadePerguntas(survey)} pergunta${quantidadePerguntas(survey) === 1 ? '' : 's'}`} tone="info" />
                            {survey.expires_at ? <StatusPill label={daysLeft(survey.expires_at) ?? ''} status={expired ? 'inativo' : 'pendente'} /> : null}
                          </View>
                        )}
                      />
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{responseCount} resposta{responseCount !== 1 ? 's' : ''}</Text>
                        <Text style={styles.metaText}>{cliente ? 'Clientes' : survey.dept_name || 'Toda a empresa'}</Text>
                      </View>
                      <View style={styles.actions}>
                        {cliente ? (
                          <>
                            <Button accessibilityLabel={`Copiar link da campanha ${survey.title}`} icon="copy-outline" label="Copiar link" onPress={() => { void copiarLink(survey); }} style={styles.actionButton} variant="ghost" />
                            <BotaoWhatsApp accessibilityLabel={`Enviar no WhatsApp: ${survey.title}`} mensagem={mensagemNps(linkPublicoPesquisa(survey.id))} style={styles.actionButton} />
                            <Button accessibilityLabel={`Mostrar QR code da campanha ${survey.title}`} icon="qr-code-outline" label="QR code" onPress={() => setQrDe(survey)} style={styles.actionButton} variant="ghost" />
                          </>
                        ) : (
                          <><Button icon="share-social-outline" label="Compartilhar" onPress={() => compartilhar(survey)} style={styles.actionButton} variant="ghost" />
                            <BotaoWhatsApp accessibilityLabel={`Enviar no WhatsApp: ${survey.title}`} mensagem={mensagemPesquisa(linkPublicoPesquisa(survey.id))} style={styles.actionButton} /></>
                        )}
                        <Button icon="bar-chart-outline" label="Ver resultados" onPress={() => router.push(cfg.rotaDetalhe(survey.id) as never)} style={styles.actionButton} variant="ghost" />
                        <Button accessibilityLabel={`Editar ${survey.title}`} icon="create-outline" label="Editar" onPress={() => editar(survey)} style={styles.actionButton} variant="ghost" />
                        <Button accessibilityLabel={`Duplicar ${survey.title}`} icon="duplicate-outline" label="Duplicar" onPress={() => { void duplicar(survey); }} style={styles.actionButton} variant="ghost" />
                        {!expired ? <Button accessibilityLabel={`Encerrar agora ${survey.title}`} icon="stop-circle-outline" label="Encerrar agora" onPress={() => encerrarAgora(survey)} style={styles.actionButton} variant="ghost" /> : null}
                        <Button accessibilityLabel={`Excluir ${survey.title}`} icon="trash-outline" onPress={() => excluir(survey)} variant="danger" />
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>

      {cliente ? <QrCodeModal link={qrDe ? linkPublicoPesquisa(qrDe.id) : ''} onClose={() => setQrDe(null)} titulo={qrDe?.title ?? ''} visible={qrDe !== null} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  content: { gap: espaco.secao, padding: espaco.xl, paddingBottom: espaco.tela },
  listCard: { overflow: 'hidden' },
  skeleton: { marginHorizontal: espaco.md, marginVertical: espaco.sm },
  surveyList: { gap: espaco.md },
  expiredCard: { opacity: 0.55 },
  rowBadges: { alignItems: 'flex-end', gap: espaco.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md, paddingHorizontal: espaco.lg, paddingVertical: espaco.sm },
  metaText: { ...tipografia.legenda, color: cores.texto.discreto },
  actions: { borderTopColor: cores.borda.sutil, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: espaco.xs, padding: espaco.sm },
  actionButton: { flex: 1 },
});
