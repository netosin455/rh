// ============================================================
// app/pesquisas/nova.tsx — Criar pesquisa (várias perguntas)
// Abre já com a 1ª pergunta em branco; cartões numerados; erros no próprio campo;
// "Ver como o colaborador vai ver" mostra a prévia sem gravar nada.
// ============================================================

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../componentes/Button';
import { Input } from '../../componentes/Input';
import { Modal } from '../../componentes/Modal';
import { PerguntaCard } from '../../componentes/PerguntaCard';
import { ResponderPesquisa } from '../../componentes/ResponderPesquisa';
import { createSurvey } from '../../conexoes/pesquisas';
import { useToast } from '../../contextos/Toast';
import { cores } from '../../estilo/cores';
import { borda, espaco } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { maskDate } from '../../helpers/datas';
import { confirmAction } from '../../helpers/confirm';
import {
  MAX_PERGUNTAS,
  PerguntaRascunho,
  adicionarPergunta,
  duplicarPergunta,
  moverPergunta,
  montarPesquisa,
  perguntaNova,
  podeAdicionarPergunta,
  previaPublica,
  removerPergunta,
  validarPesquisa,
} from '../../helpers/pesquisa';

export default function NovaPesquisaScreen() {
  const router = useRouter();
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [validade, setValidade] = useState('');
  const [perguntas, setPerguntas] = useState<PerguntaRascunho[]>(() => [perguntaNova()]);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previaAberta, setPreviaAberta] = useState(false);
  const emAndamento = useRef(false);
  const rolagem = useRef<ScrollView>(null);
  const posicoes = useRef<Record<string, number>>({});

  const validacao = validarPesquisa(titulo, validade, perguntas);
  const erros = mostrarErros ? validacao.erros : null;
  const limite = !podeAdicionarPergunta(perguntas);

  function registrarPosicao(chave: string) {
    return (e: LayoutChangeEvent) => { posicoes.current[chave] = e.nativeEvent.layout.y; };
  }

  function atualizar(indice: number, nova: PerguntaRascunho) {
    setPerguntas((atual) => atual.map((p, i) => (i === indice ? nova : p)));
  }

  function excluir(indice: number) {
    const p = perguntas[indice];
    const resumo = p?.question.trim() ? `"${p.question.trim().slice(0, 60)}"` : `a pergunta ${indice + 1}`;
    confirmAction('Excluir pergunta', `Excluir ${resumo}?`, () => setPerguntas((atual) => removerPergunta(atual, indice)));
  }

  async function criar() {
    if (emAndamento.current) return;
    if (!validacao.ok) {
      setMostrarErros(true);
      // Leva o RH até o primeiro campo com erro.
      const primeiraComErro = perguntas.find((p) => validacao.erros.perguntas[p.chave]);
      const y = validacao.erros.titulo || validacao.erros.validade ? 0 : primeiraComErro ? posicoes.current[primeiraComErro.chave] ?? 0 : 0;
      rolagem.current?.scrollTo({ y: Math.max(0, y - espaco.lg), animated: true });
      return;
    }
    emAndamento.current = true;
    setSalvando(true);
    try {
      // Escrita nunca é repetida sozinha: se falhar, o RH vê o erro e decide.
      await createSurvey(montarPesquisa(titulo, validade, perguntas));
      toast.success('Pesquisa criada. Já dá para compartilhar o link.');
      router.replace('/pesquisas' as never);
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message ? e.message : 'Não foi possível criar a pesquisa.');
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  return (
    <View style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" ref={rolagem}>
        <View style={styles.coluna}>
          <View style={styles.topo}>
            <Button accessibilityLabel="Voltar para pesquisas" disabled={salvando} icon="arrow-back-outline" onPress={() => router.replace('/pesquisas' as never)} variant="ghost" />
            <View style={styles.topoTexto}>
              <Text accessibilityRole="header" style={styles.titulo}>Nova pesquisa</Text>
              <Text style={styles.subtitulo}>Monte as perguntas. A resposta é anônima e o colaborador responde pelo link, sem login.</Text>
            </View>
          </View>

          <View style={styles.bloco}>
            <Input
              accessibilityLabel="Título da pesquisa"
              editable={!salvando}
              error={erros?.titulo}
              label="Título da pesquisa"
              onChangeText={setTitulo}
              placeholder="Ex.: Clima da equipe — Outubro"
              value={titulo}
            />
            <Input
              accessibilityLabel="Encerrar em"
              editable={!salvando}
              error={erros?.validade}
              keyboardType="numeric"
              label="Encerrar em (opcional)"
              maxLength={10}
              onChangeText={(v) => setValidade(maskDate(v))}
              placeholder="DD/MM/AAAA"
              value={validade}
            />
          </View>

          {perguntas.map((p, i) => (
            <View key={p.chave} onLayout={registrarPosicao(p.chave)}>
              <PerguntaCard
                desabilitado={salvando}
                erros={erros?.perguntas[p.chave]}
                indice={i}
                onChange={(nova) => atualizar(i, nova)}
                onDuplicar={() => setPerguntas((atual) => duplicarPergunta(atual, i))}
                onExcluir={() => excluir(i)}
                onMover={(delta) => setPerguntas((atual) => moverPergunta(atual, i, delta))}
                pergunta={p}
                podeDuplicar={!limite}
                total={perguntas.length}
              />
            </View>
          ))}

          <View style={styles.adicionar}>
            <Text accessibilityLiveRegion="polite" style={styles.contador}>{perguntas.length} de {MAX_PERGUNTAS} perguntas</Text>
            <Button accessibilityLabel="Adicionar pergunta" disabled={salvando || limite} icon="add-outline" label="Adicionar pergunta" onPress={() => setPerguntas((atual) => adicionarPergunta(atual))} variant="secondary" />
            {limite ? <Text style={styles.limite}>Limite de {MAX_PERGUNTAS} perguntas atingido.</Text> : null}
          </View>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <View style={styles.rodapeConteudo}>
          {mostrarErros && !validacao.ok ? <Text accessibilityRole="alert" style={styles.errosResumo}>Corrija {validacao.totalErros} campo{validacao.totalErros === 1 ? '' : 's'} marcado{validacao.totalErros === 1 ? '' : 's'}.</Text> : null}
          <View style={styles.rodapeBotoes}>
            <Button accessibilityLabel="Ver como o colaborador vai ver" disabled={salvando} icon="eye-outline" label="Ver como o colaborador vai ver" onPress={() => setPreviaAberta(true)} style={styles.botaoRodape} variant="secondary" />
            <Button accessibilityLabel="Criar pesquisa" disabled={salvando} icon="checkmark-outline" label="Criar pesquisa" loading={salvando} onPress={criar} style={styles.botaoRodape} />
          </View>
        </View>
      </View>

      <Modal onClose={() => setPreviaAberta(false)} subtitle="É assim que a pessoa vai ver. Nada é gravado." title="Prévia" visible={previaAberta}>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.previaScroll}>
          {previaAberta ? (
            <ResponderPesquisa
              onEnviar={async () => { /* prévia: não envia nada */ }}
              onFecharPrevia={() => setPreviaAberta(false)}
              pesquisa={previaPublica(titulo, perguntas)}
              previa
            />
          ) : null}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { backgroundColor: cores.superficie.pagina, flex: 1 },
  conteudo: { alignItems: 'center', padding: espaco.xl, paddingBottom: espaco.tela * 2 },
  coluna: { gap: espaco.lg, maxWidth: 720, width: '100%' },
  topo: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.sm },
  topoTexto: { flex: 1, gap: espaco.micro },
  titulo: { ...tipografia.titulo, color: cores.texto.primario },
  subtitulo: { ...tipografia.corpo, color: cores.texto.discreto },
  bloco: { gap: espaco.md },
  adicionar: { alignItems: 'flex-start', gap: espaco.sm },
  contador: { ...tipografia.corpoForte, color: cores.texto.secundario },
  limite: { ...tipografia.legenda, color: cores.texto.discreto },
  rodape: { backgroundColor: cores.superficie.elevada, borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, padding: espaco.md },
  rodapeConteudo: { alignSelf: 'center', gap: espaco.sm, maxWidth: 720, width: '100%' },
  errosResumo: { ...tipografia.corpoForte, color: cores.status.erro.forte },
  rodapeBotoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  botaoRodape: { flexBasis: 200, flexGrow: 1 },
  previaScroll: { maxHeight: 560 },
});
