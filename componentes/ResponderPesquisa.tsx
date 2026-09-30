// ============================================================
// componentes/ResponderPesquisa.tsx — SuperRH
// Uma pergunta por tela, para o colaborador (celular primeiro).
// Usado na página pública /responder/[id] e na prévia do RH (sem gravar nada).
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../conexoes/http';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import {
  MAX_TEXTO,
  RespostaLocal,
  RespostasLocais,
  bloqueioDeAvanco,
  estaRespondida,
  montarRespostas,
  primeiraObrigatoriaPendente,
} from '../helpers/pesquisa';
import type { PublicSurvey, SurveyAnswerInput, SurveyQuestion } from '../tipos/modelos';
import { Button } from './Button';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';

const ROTULOS_NOTA: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };
const ICONES_NOTA: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const AVISO_ANONIMATO = 'Não escreva nomes nem dados pessoais. Sua resposta é anônima.';

type ResponderPesquisaProps = {
  pesquisa: PublicSurvey;
  /** Prévia do RH: percorre tudo, mas não envia e a tela final avisa que nada foi gravado. */
  previa?: boolean;
  onEnviar: (respostas: SurveyAnswerInput[], locais: RespostasLocais) => Promise<void>;
  onFecharPrevia?: () => void;
};

function mensagemDeErro(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) return 'Você já respondeu esta pesquisa neste aparelho. Obrigado!';
  return e instanceof Error && e.message ? e.message : 'Não foi possível enviar. Tente novamente.';
}

function EscalaResposta({ pergunta, resposta, onChange }: { pergunta: SurveyQuestion; resposta?: RespostaLocal; onChange: (r: RespostaLocal) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={pergunta.question} style={styles.escala}>
      {[1, 2, 3, 4, 5].map((nota) => {
        const ativo = resposta?.score === nota;
        return (
          <Pressable
            accessibilityLabel={`${nota} — ${ROTULOS_NOTA[nota]}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo }}
            aria-checked={ativo}
            key={nota}
            onPress={() => onChange({ score: nota })}
            style={[styles.nota, ativo && styles.notaAtiva]}
          >
            <Text style={styles.notaEmoji}>{ICONES_NOTA[nota]}</Text>
            <Text style={[styles.notaNumero, ativo && styles.textoAtivo]}>{nota}</Text>
            <Text numberOfLines={2} style={[styles.notaRotulo, ativo && styles.textoAtivo]}>{ROTULOS_NOTA[nota]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EscolhaResposta({ pergunta, resposta, onChange }: { pergunta: SurveyQuestion; resposta?: RespostaLocal; onChange: (r: RespostaLocal) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={pergunta.question} style={styles.escolhas}>
      {(pergunta.options ?? []).length === 0 ? <Text style={styles.opcional}>Esta pergunta ainda não tem opções.</Text> : null}
      {(pergunta.options ?? []).map((opcao) => {
        const ativo = resposta?.choice === opcao;
        return (
          <Pressable
            accessibilityLabel={opcao}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo }}
            aria-checked={ativo}
            key={opcao}
            onPress={() => onChange({ choice: opcao })}
            style={[styles.escolha, ativo && styles.escolhaAtiva]}
          >
            <View style={[styles.radio, ativo && styles.radioAtivo]}>{ativo ? <View style={styles.radioPonto} /> : null}</View>
            <Text style={[styles.escolhaTexto, ativo && styles.escolhaTextoAtivo]}>{opcao}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ResponderPesquisa({ pesquisa, previa = false, onEnviar, onFecharPrevia }: ResponderPesquisaProps) {
  const perguntas = pesquisa.questions;
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<RespostasLocais>({});
  const [aviso, setAviso] = useState('');
  const [erroEnvio, setErroEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Trava síncrona contra duplo toque em "Enviar respostas".
  const emAndamento = useRef(false);

  const pergunta = perguntas[indice];
  const ultima = indice === perguntas.length - 1;

  if (!pergunta) {
    return <View style={styles.centro}><Text style={styles.titulo}>Esta pesquisa não tem perguntas.</Text></View>;
  }

  if (enviado) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centro}>
        <View style={styles.sucessoIcone}><Ionicons color={cores.status.sucesso.forte} name="checkmark" size={tamanho.iconeGrande} /></View>
        <Text accessibilityRole="header" style={styles.titulo}>{previa ? 'Fim da prévia' : 'Obrigado, sua resposta foi enviada'}</Text>
        <Text style={styles.subtitulo}>{previa ? 'Nada foi enviado nem gravado. É só para você ver como a pessoa vai enxergar.' : 'Ela ajuda a melhorar o ambiente de trabalho.'}</Text>
        {previa && onFecharPrevia ? <Button icon="arrow-back-outline" label="Voltar a editar" onPress={onFecharPrevia} style={styles.botaoFinal} /> : null}
      </View>
    );
  }

  function responder(r: RespostaLocal) {
    if (!pergunta) return;
    setAviso('');
    setErroEnvio('');
    setRespostas((atual) => ({ ...atual, [pergunta.id]: r }));
  }

  function proxima() {
    if (!pergunta) return;
    const bloqueio = bloqueioDeAvanco(pergunta, respostas[pergunta.id]);
    if (bloqueio) { setAviso(bloqueio); return; }
    setAviso('');
    setIndice((i) => Math.min(i + 1, perguntas.length - 1));
  }

  function voltar() {
    setAviso('');
    setErroEnvio('');
    setIndice((i) => Math.max(i - 1, 0));
  }

  async function enviar() {
    if (!pergunta || emAndamento.current) return;
    const bloqueio = bloqueioDeAvanco(pergunta, respostas[pergunta.id]);
    if (bloqueio) { setAviso(bloqueio); return; }
    const pendente = primeiraObrigatoriaPendente(perguntas, respostas);
    if (pendente >= 0) {
      setIndice(pendente);
      setAviso('Esta pergunta é obrigatória. Responda para enviar.');
      return;
    }
    emAndamento.current = true;
    setEnviando(true);
    setErroEnvio('');
    try {
      await onEnviar(montarRespostas(perguntas, respostas), respostas);
      setEnviado(true);
    } catch (e: unknown) {
      setErroEnvio(mensagemDeErro(e));
    } finally {
      emAndamento.current = false;
      setEnviando(false);
    }
  }

  const resposta = respostas[pergunta.id];
  const texto = resposta?.text ?? '';
  const jaRespondida = estaRespondida(pergunta, resposta);

  return (
    <View style={styles.raiz}>
      {previa ? <View style={styles.faixaPrevia}><Text style={styles.faixaPreviaTexto}>Prévia: nada é enviado.</Text></View> : null}
      <Text style={styles.marca}>SuperRH · {pesquisa.title}</Text>
      <View style={styles.progressoLinha}>
        <Text accessibilityLiveRegion="polite" style={styles.progressoTexto}>Pergunta {indice + 1} de {perguntas.length}</Text>
        {!pergunta.required ? <Text style={styles.opcional}>opcional</Text> : null}
      </View>
      <ProgressBar accessibilityLabel={`Pergunta ${indice + 1} de ${perguntas.length}`} tone="accent" value={((indice + 1) / perguntas.length) * 100} />

      <Text accessibilityRole="header" style={styles.pergunta}>{pergunta.question}</Text>

      {pergunta.type === 'scale' ? <EscalaResposta onChange={responder} pergunta={pergunta} resposta={resposta} /> : null}
      {pergunta.type === 'choice' ? <EscolhaResposta onChange={responder} pergunta={pergunta} resposta={resposta} /> : null}
      {pergunta.type === 'text' ? (
        <View style={styles.aberta}>
          <Input
            accessibilityLabel="Sua resposta"
            inputStyle={styles.caixaTexto}
            label="Sua resposta"
            maxLength={MAX_TEXTO}
            multiline
            onChangeText={(v) => responder({ text: v })}
            placeholder="Escreva aqui"
            textAlignVertical="top"
            value={texto}
          />
          <Text style={styles.contador}>{texto.length} de {MAX_TEXTO}</Text>
          <View style={styles.anonimato}>
            <Ionicons color={cores.texto.secundario} name="lock-closed-outline" size={tamanho.iconePequeno} />
            <Text style={styles.anonimatoTexto}>{AVISO_ANONIMATO}</Text>
          </View>
        </View>
      ) : null}

      {aviso ? <Text accessibilityRole="alert" style={styles.aviso}>{aviso}</Text> : null}
      {erroEnvio ? <Text accessibilityRole="alert" style={styles.aviso}>{erroEnvio}</Text> : null}

      <View style={styles.botoes}>
        <Button accessibilityLabel="Voltar para a pergunta anterior" disabled={indice === 0 || enviando} icon="arrow-back-outline" label="Voltar" onPress={voltar} style={styles.botao} variant="secondary" />
        {ultima
          ? <Button accessibilityLabel="Enviar respostas" disabled={enviando} icon="send-outline" label="Enviar respostas" loading={enviando} onPress={enviar} style={styles.botao} />
          : <Button accessibilityLabel="Próxima pergunta" disabled={enviando} label={!pergunta.required && !jaRespondida ? 'Pular' : 'Próxima'} onPress={proxima} style={styles.botao} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: espaco.lg },
  centro: { alignItems: 'center', gap: espaco.md, paddingVertical: espaco.secao },
  sucessoIcone: { alignItems: 'center', backgroundColor: cores.status.sucesso.superficie, borderRadius: raio.pill, height: espaco.secao, justifyContent: 'center', width: espaco.secao },
  titulo: { ...tipografia.titulo, color: cores.texto.primario, textAlign: 'center' },
  subtitulo: { ...tipografia.corpo, color: cores.texto.discreto, maxWidth: 360, textAlign: 'center' },
  botaoFinal: { marginTop: espaco.md },
  faixaPrevia: { backgroundColor: cores.accent.superficie, borderRadius: raio.controle, padding: espaco.sm },
  faixaPreviaTexto: { ...tipografia.legenda, color: cores.texto.primario, textAlign: 'center' },
  marca: { ...tipografia.legenda, color: cores.texto.discreto },
  progressoLinha: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  progressoTexto: { ...tipografia.corpoForte, color: cores.texto.primario },
  opcional: { ...tipografia.legenda, color: cores.texto.discreto },
  pergunta: { ...tipografia.titulo, color: cores.texto.primario, marginTop: espaco.md },
  escala: { flexDirection: 'row', gap: espaco.xs },
  nota: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, flex: 1, gap: espaco.micro, minHeight: tamanho.toqueMinimo + espaco.xxxl, minWidth: 0, paddingHorizontal: espaco.micro, paddingVertical: espaco.md },
  notaAtiva: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  notaEmoji: { fontSize: 22 },
  notaNumero: { ...tipografia.subtitulo, color: cores.texto.primario },
  notaRotulo: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'center' },
  textoAtivo: { color: cores.texto.sobreAccent },
  escolhas: { gap: espaco.sm },
  escolha: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo + espaco.md, padding: espaco.md },
  escolhaAtiva: { backgroundColor: cores.accent.superficie, borderColor: cores.accent.dourado },
  radio: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.pill, borderWidth: 2, height: espaco.xl, justifyContent: 'center', width: espaco.xl },
  radioAtivo: { borderColor: cores.accent.dourado },
  radioPonto: { backgroundColor: cores.accent.dourado, borderRadius: raio.pill, height: espaco.md, width: espaco.md },
  escolhaTexto: { ...tipografia.corpo, color: cores.texto.primario, flex: 1 },
  escolhaTextoAtivo: { fontWeight: '600' },
  aberta: { gap: espaco.sm },
  caixaTexto: { minHeight: espaco.tela * 2 },
  contador: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'right' },
  anonimato: { alignItems: 'flex-start', backgroundColor: cores.superficie.sutil, borderRadius: raio.controle, flexDirection: 'row', gap: espaco.sm, padding: espaco.md },
  anonimatoTexto: { ...tipografia.legenda, color: cores.texto.secundario, flex: 1 },
  aviso: { ...tipografia.corpo, color: cores.status.erro.forte },
  botoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm },
  botao: { flex: 1 },
});
