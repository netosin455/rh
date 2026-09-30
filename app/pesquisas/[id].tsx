// ============================================================
// app/pesquisas/[id].tsx — Resultados de uma pesquisa, pergunta por pergunta
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSurveyResults } from '../../conexoes/pesquisas';
import { QuestionResult, SurveyResults } from '../../tipos/modelos';
import { Badge } from '../../componentes/Badge';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { EmptyState } from '../../componentes/EmptyState';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { MetricCard } from '../../componentes/MetricCard';
import { ProgressBar } from '../../componentes/ProgressBar';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { rotuloTipo } from '../../helpers/pesquisa';

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
            <Badge label={rotuloTipo(resultado.type)} tone={resultado.type === 'scale' ? 'info' : resultado.type === 'choice' ? 'success' : 'gold'} />
            <Text style={styles.meta}>{respondidas} de {plural(total, 'participação', 'participações')}</Text>
          </View>
        </View>
      </View>

      {respondidas === 0 ? (
        <Text style={styles.vazio}>Ninguém respondeu esta pergunta ainda.</Text>
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

export default function SurveyResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  if (erro || (!loading && !dados)) {
    return (
      <View style={styles.centrado}>
        <ErroComRetry mensagem={erro ?? 'Pesquisa não encontrada.'} onTentarNovamente={carregar} />
        <Button icon="arrow-back-outline" label="Voltar para pesquisas" onPress={() => router.back()} variant="ghost" />
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
  const encerrada = Boolean(survey.expires_at && new Date(survey.expires_at) < new Date());
  const rotuloValidade = survey.expires_at ? `${encerrada ? 'Encerrada em' : 'Encerra em'} ${new Date(survey.expires_at).toLocaleDateString('pt-BR')}` : null;

  const compartilhar = () => {
    const base = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') ?? 'https://super-rh.vercel.app';
    Share.share({ message: `${survey.title}\n\nResponda aqui (é anônimo): ${base}/responder/${survey.id}` });
  };

  return (
    <ScrollView contentContainerStyle={styles.conteudo} style={styles.tela}>
      <View style={styles.pagina}>
        <ScreenHeader
          action={(
            <View style={styles.acoes}>
              <Button accessibilityLabel="Voltar para pesquisas" icon="arrow-back-outline" onPress={() => router.back()} variant="ghost" />
              <Button accessibilityLabel="Compartilhar link de resposta" icon="share-social-outline" onPress={compartilhar} variant="ghost" />
            </View>
          )}
          subtitle={survey.dept_name ?? 'Toda a empresa'}
          title={survey.title}
        />
        <View style={styles.resumo}>
          <View style={styles.metrica}><MetricCard detail="Pessoas que enviaram a pesquisa" label="Participações" value={total_responses} /></View>
          <View style={styles.metrica}><MetricCard detail="Nesta pesquisa" label="Perguntas" value={questions.length} /></View>
          {rotuloValidade ? <StatusPill label={rotuloValidade} status={encerrada ? 'inativo' : 'pendente'} /> : null}
        </View>

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
  acoes: { flexDirection: 'row', gap: espaco.xs },
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
});
