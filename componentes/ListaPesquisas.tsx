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
import { getSurveys, linkPublicoPesquisa } from '../conexoes/pesquisas';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { espaco } from '../estilo/espaco';
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
import { usarDados } from '../contextos/usarDados';
import { chaves } from '../helpers/chavesCache';
import { usarRevelacao } from '../contextos/usarRevelacao';
import { AvisoDesatualizado } from './AvisoDesatualizado';
import { EntradaItem } from './EntradaItem';
import { BotaoWhatsApp } from './BotaoWhatsApp';
import { QrCodeModal } from './QrCodeModal';
import { useAcoesPesquisa } from './useAcoesPesquisa';
import { ScreenHeader } from './ScreenHeader';
import { Section } from './Section';
import { EsqueletoCartaoTexto, EsqueletoGrupo } from './Esqueletos';
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
  // Uma chave por área (pesquisas dos colaboradores x NPS): voltar à lista mostra na hora e atualiza por baixo.
  const { dados, carregando: loading, erro, erroLeve, recarregar } = usarDados(chaves.pesquisas(cfg.audience), async () => {
    const lista = await getSurveys(cfg.audience);
    // Mesmo que a API ignore o filtro, nunca mistura as duas áreas na tela.
    return lista.filter((s) => (s.audience ?? 'employees') === cfg.audience);
  });
  const surveys: PulseSurvey[] = dados ?? [];
  const modo = usarRevelacao(loading, dados !== undefined);
  const loadError = erro !== null && dados === undefined ? (erro.message || `Não foi possível carregar ${cfg.plural}`) : '';
  const [refreshing, setRefreshing] = useState(false);
  // Campanha cujo QR code está aberto (só na área NPS).
  const [qrDe, setQrDe] = useState<PulseSurvey | null>(null);

  const ativas = surveys.filter((s) => !s.expires_at || new Date(s.expires_at) >= new Date()).length;

  const load = recarregar;
  const onRefresh = () => { setRefreshing(true); void recarregar().finally(() => setRefreshing(false)); };

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

        <AvisoDesatualizado visivel={erroLeve} />

        <MetricCard
          detail={`${surveys.length} ${surveys.length === 1 ? cfg.singular : cfg.plural} ${surveys.length === 1 ? 'criada' : 'criadas'}`}
          indicator={<StatusPill label="Ativas" status="ativo" />}
          label={cfg.metrica}
          value={loading ? '—' : ativas}
        />

        <Section description={cfg.descricaoLista} title={cfg.tituloLista}>
          {loading ? (
            <EsqueletoGrupo rotulo="Carregando" style={styles.surveyList}>
              {[0, 1, 2].map((i) => <EsqueletoCartaoTexto alturaMinima={158} key={i} linhas={2} />)}
            </EsqueletoGrupo>
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
              {surveys.map((survey, indice) => {
                const expired = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
                const responseCount = survey.response_count ?? 0;
                return (
                  <EntradaItem indice={indice} key={survey.id} modo={modo} total={surveys.length}>
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
                  </EntradaItem>
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
  // flexGrow sem flexBasis 0: cada botão tem o tamanho do próprio texto e a linha quebra; com `flex: 1` os
  // 8 botões dividiam a largura por igual e, no celular, os textos se sobrepunham.
  actionButton: { flexGrow: 1 },
});
