// ============================================================
// componentes/TelaResultados.tsx — Resultados de uma campanha, pergunta por pergunta
// Serve às DUAS áreas: Pesquisas (colaboradores) e NPS (clientes). Na área NPS acrescenta
// o painel de NPS, "Retornar contato", copiar link e QR code.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apagarContato, getSurveyResults, linkPublicoPesquisa, marcarContatado } from '../conexoes/pesquisas';
import { useToast } from '../contextos/Toast';
import { confirmAction } from '../helpers/confirm';
import { QuestionResult, SurveyContact, SurveyResults } from '../tipos/modelos';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ErroComRetry } from './ErroComRetry';
import { MetricCard } from './MetricCard';
import { ProgressBar } from './ProgressBar';
import { BotaoWhatsApp } from './BotaoWhatsApp';
import { QrCodeModal } from './QrCodeModal';
import { useAcoesPesquisa } from './useAcoesPesquisa';
import { ScreenHeader } from './ScreenHeader';
import { Skeleton } from './Skeleton';
import { StatusPill } from './StatusPill';
import { cores } from '../estilo/cores';
import { borda, espaco, raio } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import {
  AREAS_PESQUISA,
  AreaPesquisa,
  calcularNps,
  contagemDoResultado,
  distribuicaoNps,
  formatarNps,
  grupoDoNps,
  percentuaisNps,
  poucasRespostasNps,
  rotuloTipo,
  separarContatos,
  totalNps,
} from '../helpers/pesquisa';
import { mensagemNps, mensagemPesquisa } from '../helpers/whatsapp';

const ROTULOS_NOTA: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };

function tomDaNota(nota: number): 'accent' | 'success' | 'info' | 'danger' {
  if (nota <= 1) return 'danger';
  if (nota >= 5) return 'info';
  if (nota >= 4) return 'success';
  return 'accent';
}

function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

/** Barra de uma linha (nota ou opção): rótulo, contagem e percentual sobre quem respondeu a pergunta. */
function LinhaBarra({ rotulo, contagem, respondidas, tom }: { rotulo: string; contagem: number; respondidas: number; tom?: 'accent' | 'success' | 'info' | 'danger' }) {
  const percentual = respondidas > 0 ? (contagem / respondidas) * 100 : 0;
  return (
    <View style={styles.linha}>
      <View style={styles.linhaTopo}>
        <Text numberOfLines={2} style={styles.linhaRotulo}>{rotulo}</Text>
        <Text style={styles.linhaContagem}>{plural(contagem, 'resposta', 'respostas')} · {Math.round(percentual)}%</Text>
      </View>
      <ProgressBar accessibilityLabel={`${rotulo}: ${contagem} de ${respondidas}`} tone={tom} value={percentual} />
    </View>
  );
}

const COR_GRUPO = { detrator: cores.status.erro.forte, neutro: cores.status.pendente.forte, promotor: cores.status.sucesso.forte } as const;

/** Painel do NPS: número grande, faixa única promotores/neutros/detratores, contagens e distribuição de 0 a 10. */
function NpsResultado({ resultado }: { resultado: QuestionResult }) {
  const contagem = contagemDoResultado(resultado);
  const total = totalNps(contagem);
  // O servidor é a fonte oficial do NPS; se o campo não vier, calcula com a mesma regra.
  const nps = resultado.nps !== undefined ? resultado.nps : calcularNps(contagem);
  const pct = percentuaisNps(contagem);
  const dist = distribuicaoNps(resultado.distribution);
  const maior = Math.max(...dist, 1);
  const grupos = [
    { chave: 'promotor' as const, rotulo: 'Promotores (9 e 10)', n: contagem.promoters, p: pct.promotores },
    { chave: 'neutro' as const, rotulo: 'Neutros (7 e 8)', n: contagem.passives, p: pct.neutros },
    { chave: 'detrator' as const, rotulo: 'Detratores (0 a 6)', n: contagem.detractors, p: pct.detratores },
  ];
  return (
    <View style={styles.corpo}>
      <View style={styles.npsTopo}>
        <Text accessibilityLabel={nps == null ? 'NPS: sem dados' : `NPS ${formatarNps(nps)}`} style={[styles.npsValor, nps == null && styles.npsSemDados]}>{formatarNps(nps)}</Text>
        <Text style={styles.meta}>{nps == null ? 'Ainda não há respostas para calcular o NPS.' : 'NPS: % de promotores menos % de detratores (de −100 a +100).'}</Text>
      </View>
      {poucasRespostasNps(total) ? (
        <View accessibilityRole="alert" style={styles.npsAviso}><Text style={styles.npsAvisoTexto}>Poucas respostas ({total}): use este número com cautela.</Text></View>
      ) : null}

      {/* Faixa única: o tamanho de cada trecho é a parte de cada grupo. */}
      <View accessibilityLabel={`Detratores ${contagem.detractors}, neutros ${contagem.passives}, promotores ${contagem.promoters}`} accessibilityRole="image" style={styles.faixa}>
        {total === 0 ? <View style={[styles.faixaTrecho, { backgroundColor: cores.borda.sutil, flex: 1 }]} /> : [...grupos].reverse().map((g) => (g.n > 0 ? <View key={g.chave} style={[styles.faixaTrecho, { backgroundColor: COR_GRUPO[g.chave], flex: g.n }]} /> : null))}
      </View>
      <View style={styles.legenda}>
        {grupos.map((g) => (
          <View key={g.chave} style={styles.legendaItem}>
            <View style={[styles.legendaPonto, { backgroundColor: COR_GRUPO[g.chave] }]} />
            <Text style={styles.legendaTexto}>{g.rotulo}: <Text style={styles.legendaNegrito}>{g.n}</Text> · {Math.round(g.p)}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.subTitulo}>Notas de 0 a 10</Text>
      <View accessibilityLabel="Quantidade de respostas por nota, de 0 a 10" style={styles.colunas}>
        {dist.map((n, nota) => (
          <View key={nota} style={styles.coluna}>
            <Text style={styles.colunaContagem}>{n}</Text>
            <View style={[styles.colunaBarra, { backgroundColor: COR_GRUPO[grupoDoNps(nota)], height: Math.max(3, (n / maior) * 72) }]} />
            <Text style={styles.colunaNota}>{nota}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

type LinhaContatoProps = {
  contato: SurveyContact;
  ocupado: boolean;
  onMarcar: (c: SurveyContact) => void;
  onApagar: (c: SurveyContact) => void;
};

function LinhaContato({ contato, ocupado, onMarcar, onApagar }: LinhaContatoProps) {
  const grupo = contato.score != null ? grupoDoNps(contato.score) : null;
  return (
    <View accessibilityLabel={`Contato de ${contato.name ?? 'cliente'}`} style={styles.contato}>
      <View style={styles.contatoTopo}>
        <View style={styles.contatoDados}>
          <Text style={styles.contatoNome}>{contato.name ?? 'Cliente (sem nome)'}</Text>
          {contato.phone ? <Text selectable style={styles.contatoLinha}>Telefone: {contato.phone}</Text> : null}
          {contato.email ? <Text selectable style={styles.contatoLinha}>E-mail: {contato.email}</Text> : null}
        </View>
        {contato.score != null && grupo ? (
          <View style={[styles.nota, { borderColor: COR_GRUPO[grupo] }]}>
            <Text style={[styles.notaValor, { color: COR_GRUPO[grupo] }]}>{contato.score}</Text>
            <Text style={styles.notaRotulo}>nota</Text>
          </View>
        ) : null}
      </View>
      {contato.comment ? <View style={styles.texto}><Text style={styles.textoConteudo}>{contato.comment}</Text></View> : null}
      <View style={styles.contatoAcoes}>
        {contato.contacted_at ? (
          <View accessibilityLabel="Já contatado" style={styles.contatado}><Text style={styles.contatadoTexto}>Contatado em {dataCurta(contato.contacted_at)}</Text></View>
        ) : (
          <Button accessibilityLabel={`Marcar ${contato.name ?? 'cliente'} como contatado`} disabled={ocupado} icon="checkmark-outline" label="Marcar como contatado" loading={ocupado} onPress={() => onMarcar(contato)} variant="secondary" />
        )}
        <Button accessibilityLabel={`Apagar o contato de ${contato.name ?? 'cliente'}`} disabled={ocupado} icon="trash-outline" label="Apagar contato" onPress={() => onApagar(contato)} variant="ghost" />
      </View>
    </View>
  );
}

function ResultadoPergunta({ resultado, total }: { resultado: QuestionResult; total: number }) {
  const respondidas = resultado.answered;
  const distribuicao = resultado.distribution ?? {};
  return (
    <Card accessibilityLabel={`Resultado da pergunta ${resultado.position}`} style={styles.pergunta}>
      <View style={styles.perguntaTopo}>
        <View style={styles.numero}><Text style={styles.numeroTexto}>{resultado.position}</Text></View>
        <View style={styles.perguntaTextos}>
          <Text accessibilityRole="header" style={styles.perguntaTitulo}>{resultado.question}</Text>
          <View style={styles.perguntaMeta}>
            <Badge label={rotuloTipo(resultado.type)} tone={resultado.type === 'scale' || resultado.type === 'nps' ? 'info' : resultado.type === 'choice' ? 'success' : 'gold'} />
            <Text style={styles.meta}>{respondidas} de {plural(total, 'participação', 'participações')}</Text>
          </View>
        </View>
      </View>

      {respondidas === 0 ? (
        <Text style={styles.vazio}>Ninguém respondeu esta pergunta ainda.</Text>
      ) : resultado.type === 'nps' ? (
        <NpsResultado resultado={resultado} />
      ) : resultado.type === 'scale' ? (
        <View style={styles.corpo}>
          {resultado.avg !== undefined ? (
            <View style={styles.media}>
              <Text style={styles.mediaValor}>{resultado.avg.toFixed(1).replace('.', ',')}</Text>
              <Text style={styles.meta}>média em uma escala de 1 a 5</Text>
            </View>
          ) : null}
          {[5, 4, 3, 2, 1].map((nota) => (
            <LinhaBarra contagem={distribuicao[String(nota)] ?? 0} key={nota} respondidas={respondidas} rotulo={`${nota} — ${ROTULOS_NOTA[nota]}`} tom={tomDaNota(nota)} />
          ))}
        </View>
      ) : resultado.type === 'choice' ? (
        <View style={styles.corpo}>
          {Object.entries(distribuicao).map(([opcao, contagem]) => (
            <LinhaBarra contagem={contagem} key={opcao} respondidas={respondidas} rotulo={opcao} />
          ))}
        </View>
      ) : (
        <View style={styles.corpo}>
          <Text style={styles.aviso}>Respostas anônimas. Se alguém escreveu nomes ou dados pessoais, trate com cuidado.</Text>
          {(resultado.texts ?? []).map((texto, i) => (
            <View key={i} style={styles.texto}><Text style={styles.textoConteudo}>{texto}</Text></View>
          ))}
          {(resultado.texts?.length ?? 0) < respondidas ? <Text style={styles.meta}>Mostrando as {resultado.texts?.length ?? 0} respostas mais recentes.</Text> : null}
        </View>
      )}
    </Card>
  );
}

export function TelaResultados({ area }: { area: AreaPesquisa }) {
  const cfg = AREAS_PESQUISA[area];
  const cliente = area === 'nps';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [qrAberto, setQrAberto] = useState(false);
  const toast = useToast();
  const [ocupadoId, setOcupadoId] = useState<number | null>(null);
  const [dados, setDados] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro(null);
    getSurveyResults(Number(id))
      .then(setDados)
      .catch((e: unknown) => setErro(e instanceof Error && e.message ? e.message : 'Erro ao carregar resultados'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);
  const { editar, duplicar, encerrarAgora } = useAcoesPesquisa(area, carregar);

  // Cada campanha só abre na sua área: link de campanha de cliente em /pesquisas (ou o contrário) é redirecionado.
  useEffect(() => {
    if (!dados) return;
    const audience = dados.survey.audience ?? 'employees';
    if (audience !== cfg.audience) {
      const outra = AREAS_PESQUISA[area === 'nps' ? 'pesquisas' : 'nps'];
      router.replace(outra.rotaDetalhe(dados.survey.id) as never);
    }
  }, [dados, cfg.audience, area, router]);

  function atualizarContatos(fn: (lista: SurveyContact[]) => SurveyContact[]) {
    setDados((atual) => (atual ? { ...atual, contacts: fn(atual.contacts ?? []) } : atual));
  }

  async function marcar(c: SurveyContact) {
    if (ocupadoId != null || !dados) return;
    setOcupadoId(c.submission_id);
    try {
      const r = await marcarContatado(dados.survey.id, c.submission_id);
      atualizarContatos((lista) => lista.map((x) => (x.submission_id === c.submission_id ? { ...x, contacted_at: r?.contacted_at ?? new Date().toISOString() } : x)));
      toast.success('Marcado como contatado.');
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message ? e.message : 'Não foi possível marcar como contatado.');
    } finally {
      setOcupadoId(null);
    }
  }

  function apagar(c: SurveyContact) {
    if (!dados) return;
    const surveyId = dados.survey.id;
    confirmAction(
      'Apagar contato',
      'Apagar nome, telefone e e-mail deste cliente? A nota e as respostas continuam, sem identificação. Não dá para desfazer.',
      async () => {
        setOcupadoId(c.submission_id);
        try {
          await apagarContato(surveyId, c.submission_id);
          atualizarContatos((lista) => lista.filter((x) => x.submission_id !== c.submission_id));
          toast.success('Contato apagado.');
        } catch (e: unknown) {
          toast.error(e instanceof Error && e.message ? e.message : 'Não foi possível apagar o contato.');
        } finally {
          setOcupadoId(null);
        }
      },
    );
  }

  if (erro || (!loading && !dados)) {
    return (
      <View style={styles.centrado}>
        <ErroComRetry mensagem={erro ?? 'Pesquisa não encontrada.'} onTentarNovamente={carregar} />
        <Button icon="arrow-back-outline" label={cliente ? 'Voltar para NPS' : 'Voltar para pesquisas'} onPress={() => router.replace(cfg.rotaRaiz as never)} variant="ghost" />
      </View>
    );
  }

  if (loading || !dados) {
    return (
      <View style={styles.carregando}>
        <Skeleton accessibilityLabel="Carregando título da pesquisa" height={espaco.tela} />
        <Skeleton accessibilityLabel="Carregando métricas da pesquisa" height={espaco.tela} />
        <Skeleton accessibilityLabel="Carregando perguntas" height={espaco.gigante} />
      </View>
    );
  }

  const { survey, total_responses, questions } = dados;
  const { aRetornar, outros } = separarContatos(dados.contacts);
  const encerrada = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
  const rotuloValidade = survey.expires_at ? `${encerrada ? 'Encerrada em' : 'Encerra em'} ${new Date(survey.expires_at).toLocaleDateString('pt-BR')}` : null;

  const compartilhar = () => {
    Share.share({ message: `${survey.title}\n\nResponda aqui (é anônimo): ${linkPublicoPesquisa(survey.id)}` });
  };

  const copiarLink = async () => {
    await Clipboard.setStringAsync(linkPublicoPesquisa(survey.id));
    toast.success('Link copiado. É só colar no WhatsApp ou no e-mail.');
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} style={styles.tela}>
      <View style={styles.pagina}>
        <ScreenHeader
          action={(
            <View style={styles.acoes}>
              <Button accessibilityLabel={cliente ? 'Voltar para NPS' : 'Voltar para pesquisas'} icon="arrow-back-outline" onPress={() => router.replace(cfg.rotaRaiz as never)} variant="ghost" />
              <BotaoWhatsApp mensagem={(cliente ? mensagemNps : mensagemPesquisa)(linkPublicoPesquisa(survey.id))} />
              <Button accessibilityLabel={`Editar ${cfg.singular}`} icon="create-outline" label="Editar" onPress={() => editar(survey)} variant="ghost" />
              <Button accessibilityLabel={`Duplicar ${cfg.singular}`} icon="duplicate-outline" label="Duplicar" onPress={() => { void duplicar(survey); }} variant="ghost" />
              {!encerrada ? <Button accessibilityLabel={`Encerrar ${cfg.singular} agora`} icon="stop-circle-outline" label="Encerrar agora" onPress={() => encerrarAgora(survey)} variant="ghost" /> : null}
              {cliente ? (
                <>
                  <Button accessibilityLabel="Copiar link da campanha" icon="copy-outline" onPress={() => { void copiarLink(); }} variant="ghost" />
                  <Button accessibilityLabel="Mostrar QR code da campanha" icon="qr-code-outline" onPress={() => setQrAberto(true)} variant="ghost" />
                </>
              ) : (
                <Button accessibilityLabel="Compartilhar link de resposta" icon="share-social-outline" onPress={compartilhar} variant="ghost" />
              )}
            </View>
          )}
          subtitle={cliente ? 'Clientes' : survey.dept_name ?? 'Toda a empresa'}
          title={survey.title}
        />
        <View style={styles.resumo}>
          <View style={styles.metrica}><MetricCard detail="Pessoas que enviaram a pesquisa" label="Participações" value={total_responses} /></View>
          <View style={styles.metrica}><MetricCard detail="Nesta pesquisa" label="Perguntas" value={questions.length} /></View>
          {rotuloValidade ? <StatusPill label={rotuloValidade} status={encerrada ? 'inativo' : 'pendente'} /> : null}
        </View>

        {cliente ? (
          <View style={styles.retorno}>
            <Text accessibilityRole="header" style={styles.retornoTitulo}>Retornar contato</Text>
            <Text style={styles.meta}>Clientes que deram nota de 0 a 6 e aceitaram ser contatados. Os dados ficam só aqui e você pode apagá-los a pedido do cliente.</Text>
            {aRetornar.length === 0 ? <Text style={styles.vazio}>Nenhum detrator pediu contato por enquanto.</Text> : aRetornar.map((c) => <LinhaContato contato={c} key={c.submission_id} ocupado={ocupadoId === c.submission_id} onApagar={apagar} onMarcar={marcar} />)}
            {outros.length > 0 ? (
              <View style={styles.outros}>
                <Text style={styles.subTitulo}>Outros clientes que pediram contato</Text>
                {outros.map((c) => <LinhaContato contato={c} key={c.submission_id} ocupado={ocupadoId === c.submission_id} onApagar={apagar} onMarcar={marcar} />)}
              </View>
            ) : null}
          </View>
        ) : null}

        {total_responses === 0 ? (
          <EmptyState
            action={<Button icon="share-social-outline" label="Compartilhar link" onPress={compartilhar} />}
            description="Compartilhe o link para começar a receber as respostas da equipe."
            icon="clipboard-outline"
            title="Nenhuma resposta ainda"
          />
        ) : (
          questions.map((q) => <ResultadoPergunta key={q.question_id} resultado={q} total={total_responses} />)
        )}
        {cliente ? <QrCodeModal link={linkPublicoPesquisa(survey.id)} onClose={() => setQrAberto(false)} titulo={survey.title} visible={qrAberto} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { backgroundColor: cores.superficie.pagina, flex: 1 },
  conteudo: { alignItems: 'center', padding: espaco.xl, paddingBottom: espaco.tela },
  pagina: { gap: espaco.xl, maxWidth: 760, width: '100%' },
  centrado: { alignItems: 'center', backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.md, justifyContent: 'center', padding: espaco.xl },
  carregando: { backgroundColor: cores.superficie.pagina, flex: 1, gap: espaco.lg, padding: espaco.xl },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.xs, justifyContent: 'flex-end' },
  resumo: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  metrica: { flexBasis: 160, flexGrow: 1 },
  pergunta: { gap: espaco.lg },
  perguntaTopo: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.md },
  numero: { alignItems: 'center', backgroundColor: cores.accent.dourado, borderRadius: raio.pill, height: espaco.xxl, justifyContent: 'center', width: espaco.xxl },
  numeroTexto: { ...tipografia.corpoForte, color: cores.texto.sobreAccent },
  perguntaTextos: { flex: 1, gap: espaco.sm },
  perguntaTitulo: { ...tipografia.subtitulo, color: cores.texto.primario },
  perguntaMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  meta: { ...tipografia.legenda, color: cores.texto.discreto },
  vazio: { ...tipografia.corpo, color: cores.texto.discreto },
  corpo: { gap: espaco.md },
  media: { alignItems: 'baseline', flexDirection: 'row', gap: espaco.sm },
  mediaValor: { ...tipografia.titulo, color: cores.texto.primario },
  linha: { gap: espaco.xs },
  linhaTopo: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  linhaRotulo: { ...tipografia.corpoForte, color: cores.texto.primario, flex: 1 },
  linhaContagem: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  aviso: { ...tipografia.legenda, color: cores.texto.discreto },
  texto: { backgroundColor: cores.superficie.sutil, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, padding: espaco.md },
  textoConteudo: { ...tipografia.corpo, color: cores.texto.primario },
  npsTopo: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  npsValor: { color: cores.texto.primario, fontSize: 56, fontWeight: '700', lineHeight: 64 },
  npsSemDados: { color: cores.texto.discreto, fontSize: 28, lineHeight: 36 },
  npsAviso: { backgroundColor: cores.status.pendente.superficie, borderColor: cores.status.pendente.borda, borderRadius: raio.controle, borderWidth: borda.fina, padding: espaco.md },
  npsAvisoTexto: { ...tipografia.corpo, color: cores.texto.primario },
  faixa: { borderRadius: raio.pill, flexDirection: 'row', height: 16, overflow: 'hidden' },
  faixaTrecho: { height: 16 },
  legenda: { gap: espaco.xs },
  legendaItem: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  legendaPonto: { borderRadius: raio.pill, height: 10, width: 10 },
  legendaTexto: { ...tipografia.corpo, color: cores.texto.secundario },
  legendaNegrito: { ...tipografia.corpoForte, color: cores.texto.primario },
  subTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  colunas: { alignItems: 'flex-end', flexDirection: 'row', gap: espaco.xs, minHeight: 110 },
  coluna: { alignItems: 'center', flex: 1, gap: espaco.micro, justifyContent: 'flex-end', minWidth: 0 },
  colunaContagem: { ...tipografia.legenda, color: cores.texto.discreto },
  colunaBarra: { borderRadius: raio.controle, width: '70%' },
  colunaNota: { ...tipografia.corpoForte, color: cores.texto.primario },
  retorno: { backgroundColor: cores.superficie.elevada, borderColor: cores.borda.sutil, borderRadius: raio.cartao, borderWidth: borda.fina, gap: espaco.md, padding: espaco.lg },
  retornoTitulo: { ...tipografia.subtitulo, color: cores.texto.primario },
  outros: { gap: espaco.md, marginTop: espaco.md },
  contato: { backgroundColor: cores.superficie.sutil, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, gap: espaco.md, padding: espaco.md },
  contatoTopo: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.md, justifyContent: 'space-between' },
  contatoDados: { flex: 1, gap: espaco.micro, minWidth: 0 },
  contatoNome: { ...tipografia.corpoForte, color: cores.texto.primario },
  contatoLinha: { ...tipografia.corpo, color: cores.texto.secundario },
  nota: { alignItems: 'center', borderRadius: raio.controle, borderWidth: 2, minWidth: 56, paddingHorizontal: espaco.sm, paddingVertical: espaco.xs },
  notaValor: { ...tipografia.titulo },
  notaRotulo: { ...tipografia.legenda, color: cores.texto.discreto },
  contatoAcoes: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  contatado: { backgroundColor: cores.status.sucesso.superficie, borderRadius: raio.pill, paddingHorizontal: espaco.md, paddingVertical: espaco.xs },
  contatadoTexto: { ...tipografia.legenda, color: cores.status.sucesso.forte },
});
