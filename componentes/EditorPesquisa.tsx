// ============================================================
// componentes/EditorPesquisa.tsx — SuperRH
// Editor de pesquisa com várias perguntas. Serve às DUAS áreas, sem duplicar código:
//  - "pesquisas" (colaboradores): escala, escolha e aberta; começa com 1 pergunta em branco
//  - "nps" (clientes): nota NPS, escala e aberta; começa com o modelo "Satisfação do cliente"
// Cartões numerados, erros no próprio campo, prévia sem gravar nada.
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createSurvey } from '../conexoes/pesquisas';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { confirmAction } from '../helpers/confirm';
import { maskDate } from '../helpers/datas';
import {
  AREAS_PESQUISA,
  AreaPesquisa,
  MAX_PERGUNTAS,
  PerguntaRascunho,
  TIPOS_POR_AREA,
  TITULO_MODELO_CLIENTE,
  adicionarPergunta,
  duplicarPergunta,
  modeloSatisfacaoCliente,
  montarPesquisa,
  moverPergunta,
  perguntaNova,
  podeAdicionarPergunta,
  previaPublica,
  removerPergunta,
  validarPesquisa,
} from '../helpers/pesquisa';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { PerguntaCard } from './PerguntaCard';
import { ResponderPesquisa } from './ResponderPesquisa';

type EditorPesquisaProps = { area: AreaPesquisa };

export function EditorPesquisa({ area }: EditorPesquisaProps) {
  const cfg = AREAS_PESQUISA[area];
  const cliente = area === 'nps';
  const router = useRouter();
  const toast = useToast();
  // NPS já nasce com o modelo montado e o título sugerido; Pesquisas com 1 pergunta em branco.
  const [titulo, setTitulo] = useState(cliente ? TITULO_MODELO_CLIENTE : '');
  const [validade, setValidade] = useState('');
  const [perguntas, setPerguntas] = useState<PerguntaRascunho[]>(() => (cliente ? modeloSatisfacaoCliente() : [perguntaNova()]));
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

  // Recoloca as 4 perguntas do modelo (só na área NPS).
  function usarModelo() {
    confirmAction('Usar o modelo', 'As perguntas atuais serão substituídas pelas 4 perguntas do modelo "Satisfação do cliente". Continuar?', () => {
      setPerguntas(modeloSatisfacaoCliente());
      setTitulo((atual) => (atual.trim() ? atual : TITULO_MODELO_CLIENTE));
      setMostrarErros(false);
    });
  }

  async function criar() {
    if (emAndamento.current) return;
    if (!validacao.ok) {
      setMostrarErros(true);
      // Leva a pessoa até o primeiro campo com erro.
      const primeiraComErro = perguntas.find((p) => validacao.erros.perguntas[p.chave]);
      const y = validacao.erros.titulo || validacao.erros.validade ? 0 : primeiraComErro ? posicoes.current[primeiraComErro.chave] ?? 0 : 0;
      rolagem.current?.scrollTo({ y: Math.max(0, y - espaco.lg), animated: true });
      return;
    }
    emAndamento.current = true;
    setSalvando(true);
    try {
      // Escrita nunca é repetida sozinha: se falhar, a pessoa vê o erro e decide.
      await createSurvey(montarPesquisa(titulo, validade, perguntas, cfg.audience));
      toast.success(cliente ? 'Campanha criada. Na lista, copie o link ou mostre o QR code.' : 'Pesquisa criada. Já dá para compartilhar o link.');
      router.replace(cfg.rotaRaiz as never);
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message ? e.message : `Não foi possível criar ${cliente ? 'a campanha' : 'a pesquisa'}.`);
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  const quem = cliente ? 'o cliente' : 'o colaborador';

  return (
    <View style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" ref={rolagem}>
        <View style={styles.coluna}>
          <View style={styles.topo}>
            <Button accessibilityLabel={`Voltar para ${cliente ? 'NPS' : 'pesquisas'}`} disabled={salvando} icon="arrow-back-outline" onPress={() => router.replace(cfg.rotaRaiz as never)} variant="ghost" />
            <View style={styles.topoTexto}>
              <Text accessibilityRole="header" style={styles.titulo}>{cliente ? 'Nova campanha NPS' : 'Nova pesquisa'}</Text>
              <Text style={styles.subtitulo}>
                {cliente
                  ? 'Clientes respondem pelo link ou QR code, sem login. A resposta é anônima; o contato só é guardado se o cliente aceitar.'
                  : 'Monte as perguntas. A resposta é anônima e o colaborador responde pelo link, sem login.'}
              </Text>
            </View>
          </View>

          {cliente ? (
            <View style={styles.modelo}>
              <View style={styles.modeloTopo}>
                <Ionicons color={cores.accent.douradoProfundo} name="sparkles-outline" size={tamanho.iconeMedio} />
                <Text style={styles.modeloTitulo}>Modelo pronto: {TITULO_MODELO_CLIENTE}</Text>
              </View>
              <Text style={styles.modeloTexto}>4 perguntas já montadas: nota de 0 a 10 (NPS), motivo da nota, atendimento e clareza das informações. Você pode editar todas, apagar ou acrescentar.</Text>
              <Text style={styles.modeloTexto}>Público: <Text style={styles.negrito}>Clientes</Text> (fixo nesta área).</Text>
              <Button accessibilityLabel="Usar o modelo Satisfação do cliente" disabled={salvando} icon="refresh-outline" label="Recomeçar do modelo" onPress={usarModelo} style={styles.modeloBotao} variant="secondary" />
            </View>
          ) : null}

          <View style={styles.bloco}>
            <Input
              accessibilityLabel={`Título da ${cliente ? 'campanha' : 'pesquisa'}`}
              editable={!salvando}
              error={erros?.titulo}
              label={`Título da ${cliente ? 'campanha' : 'pesquisa'}`}
              onChangeText={setTitulo}
              placeholder={cliente ? 'Ex.: Satisfação — Outubro' : 'Ex.: Clima da equipe — Outubro'}
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
                tipos={TIPOS_POR_AREA[area]}
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
            <Button accessibilityLabel={`Ver como ${quem} vai ver`} disabled={salvando} icon="eye-outline" label={`Ver como ${quem} vai ver`} onPress={() => setPreviaAberta(true)} style={styles.botaoRodape} variant="secondary" />
            <Button accessibilityLabel={cliente ? 'Criar campanha' : 'Criar pesquisa'} disabled={salvando} icon="checkmark-outline" label={cliente ? 'Criar campanha' : 'Criar pesquisa'} loading={salvando} onPress={criar} style={styles.botaoRodape} />
          </View>
        </View>
      </View>

      <Modal onClose={() => setPreviaAberta(false)} subtitle="É assim que a pessoa vai ver. Nada é gravado." title="Prévia" visible={previaAberta}>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.previaScroll}>
          {previaAberta ? (
            <ResponderPesquisa
              onEnviar={async () => { /* prévia: não envia nada */ }}
              onFecharPrevia={() => setPreviaAberta(false)}
              pesquisa={previaPublica(titulo, perguntas, cfg.audience)}
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
  modelo: { backgroundColor: cores.accent.superficie, borderRadius: raio.cartao, gap: espaco.sm, padding: espaco.md },
  modeloTopo: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  modeloTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  modeloTexto: { ...tipografia.corpo, color: cores.texto.secundario },
  negrito: { ...tipografia.corpoForte, color: cores.texto.primario },
  modeloBotao: { alignSelf: 'flex-start' },
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
