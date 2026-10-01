// ============================================================
// componentes/ResponderPesquisa.tsx — SuperRH
// Uma pergunta por tela, para o respondente (celular primeiro).
// Usado na página pública /responder/[id] e na prévia do RH (sem gravar nada).
// Pesquisa de CLIENTE (audience = customers): linguagem de cliente, pergunta NPS de 0 a 10
// e um passo final opcional de contato, só com consentimento explícito (LGPD).
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ApiError } from '../conexoes/http';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import {
  CONTATO_VAZIO,
  ContatoRascunho,
  ErrosContato,
  MAX_EMAIL_CONTATO,
  MAX_NOME_CONTATO,
  MAX_TELEFONE_CONTATO,
  MAX_TEXTO,
  RespostaLocal,
  RespostasLocais,
  TEXTO_CONSENTIMENTO,
  bloqueioDeAvanco,
  estaRespondida,
  montarContato,
  montarRespostas,
  primeiraObrigatoriaPendente,
  validarContato,
} from '../helpers/pesquisa';
import type { PublicSurvey, SurveyAnswerInput, SurveyContactInput, SurveyQuestion } from '../tipos/modelos';
import { Button } from './Button';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';

const ROTULOS_NOTA: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' };
const ICONES_NOTA: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const AVISO_ANONIMATO = 'Não escreva nomes nem dados pessoais. Sua resposta é anônima.';
const AVISO_CLIENTE = 'Não escreva dados do seu processo, números de documentos ou informações sigilosas.';
const NOTAS_NPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type ResponderPesquisaProps = {
  pesquisa: PublicSurvey;
  /** Prévia do RH: percorre tudo, mas não envia e a tela final avisa que nada foi gravado. */
  previa?: boolean;
  onEnviar: (respostas: SurveyAnswerInput[], locais: RespostasLocais, contato: SurveyContactInput | null) => Promise<void>;
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

/** NPS: 11 botões grandes de 0 a 10. Em tela estreita ficam em 2 linhas (6 + 5), bem espaçadas. */
function NpsResposta({ pergunta, resposta, onChange }: { pergunta: SurveyQuestion; resposta?: RespostaLocal; onChange: (r: RespostaLocal) => void }) {
  const { width } = useWindowDimensions();
  const umaLinha = width >= 560;
  return (
    <View style={styles.nps}>
      <View accessibilityRole="radiogroup" accessibilityLabel={pergunta.question} style={styles.npsGrade}>
        {NOTAS_NPS.map((nota) => {
          const ativo = resposta?.score === nota;
          return (
            <Pressable
              accessibilityLabel={`Nota ${nota}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo }}
              aria-checked={ativo}
              key={nota}
              onPress={() => onChange({ score: nota })}
              style={[styles.npsBotao, umaLinha ? styles.npsBotaoLinha : styles.npsBotaoDuasLinhas, ativo && styles.notaAtiva]}
            >
              <Text style={[styles.npsNumero, ativo && styles.textoAtivo]}>{nota}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.npsRotulos}>
        <Text style={styles.npsRotulo}>0 = Nada provável</Text>
        <Text style={styles.npsRotulo}>10 = Muito provável</Text>
      </View>
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

type PassoContatoProps = {
  contato: ContatoRascunho;
  erros: ErrosContato;
  desabilitado: boolean;
  onChange: (c: ContatoRascunho) => void;
};

/** Passo final (só clientes): contato opcional. Os campos só ficam ativos com o consentimento marcado. */
function PassoContato({ contato, erros, desabilitado, onChange }: PassoContatoProps) {
  const ativo = contato.consentimento;
  return (
    <View style={styles.contato}>
      <Text accessibilityRole="header" style={styles.pergunta}>Quer que entremos em contato?</Text>
      <Text style={styles.subtitulo}>É opcional. Se preferir, é só enviar: sua avaliação continua anônima.</Text>

      <Pressable
        accessibilityLabel="Sim, aceito ser contatado sobre esta avaliação"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ativo, disabled: desabilitado }}
        aria-checked={ativo}
        disabled={desabilitado}
        // Ao desmarcar, apaga o que foi digitado: sem consentimento nenhum dado pessoal fica na tela.
        onPress={() => onChange(ativo ? CONTATO_VAZIO : { ...contato, consentimento: true })}
        style={[styles.consentimento, ativo && styles.consentimentoAtivo]}
      >
        <View style={[styles.caixa, ativo && styles.caixaMarcada]}>{ativo ? <Ionicons color={cores.texto.sobreAccent} name="checkmark" size={tamanho.iconePequeno} /> : null}</View>
        <View style={styles.consentimentoTexto}>
          <Text style={styles.consentimentoTitulo}>Sim, podem entrar em contato comigo</Text>
          <Text style={styles.consentimentoFinalidade}>{TEXTO_CONSENTIMENTO}</Text>
        </View>
      </Pressable>

      <View style={[styles.camposContato, !ativo && styles.camposDesligados]}>
        <Input
          accessibilityLabel="Seu nome"
          autoComplete="name"
          editable={ativo && !desabilitado}
          error={erros.nome}
          label="Seu nome"
          maxLength={MAX_NOME_CONTATO}
          onChangeText={(v) => onChange({ ...contato, nome: v })}
          placeholder="Como podemos te chamar?"
          value={contato.nome}
        />
        <Input
          accessibilityLabel="Seu telefone"
          autoComplete="tel"
          editable={ativo && !desabilitado}
          error={erros.telefone}
          keyboardType="phone-pad"
          label="Telefone (com DDD)"
          maxLength={MAX_TELEFONE_CONTATO}
          onChangeText={(v) => onChange({ ...contato, telefone: v })}
          placeholder="(11) 99999-9999"
          value={contato.telefone}
        />
        <Input
          accessibilityLabel="Seu e-mail"
          autoCapitalize="none"
          autoComplete="email"
          editable={ativo && !desabilitado}
          error={erros.email}
          keyboardType="email-address"
          label="E-mail"
          maxLength={MAX_EMAIL_CONTATO}
          onChangeText={(v) => onChange({ ...contato, email: v })}
          placeholder="voce@exemplo.com"
          value={contato.email}
        />
        {erros.contato ? <Text accessibilityRole="alert" style={styles.aviso}>{erros.contato}</Text> : null}
      </View>
    </View>
  );
}

export function ResponderPesquisa({ pesquisa, previa = false, onEnviar, onFecharPrevia }: ResponderPesquisaProps) {
  const perguntas = pesquisa.questions;
  const cliente = pesquisa.audience === 'customers';
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<RespostasLocais>({});
  const [contato, setContato] = useState<ContatoRascunho>(CONTATO_VAZIO);
  const [errosContato, setErrosContato] = useState<ErrosContato>({});
  const [aviso, setAviso] = useState('');
  const [erroEnvio, setErroEnvio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // Trava síncrona contra duplo toque em "Enviar respostas".
  const emAndamento = useRef(false);

  // Clientes têm um passo extra (contato) depois da última pergunta.
  const totalPassos = perguntas.length + (cliente ? 1 : 0);
  const noContato = cliente && indice === perguntas.length;
  const pergunta = perguntas[indice];
  const ultimoPasso = indice === totalPassos - 1;

  if (perguntas.length === 0) {
    return <View style={styles.centro}><Text style={styles.titulo}>Esta pesquisa não tem perguntas.</Text></View>;
  }

  if (enviado) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centro}>
        <View style={styles.sucessoIcone}><Ionicons color={cores.status.sucesso.forte} name="checkmark" size={tamanho.iconeGrande} /></View>
        <Text accessibilityRole="header" style={styles.titulo}>
          {previa ? 'Fim da prévia' : cliente ? 'Obrigado pela sua avaliação!' : 'Obrigado, sua resposta foi enviada'}
        </Text>
        <Text style={styles.subtitulo}>
          {previa
            ? 'Nada foi enviado nem gravado. É só para você ver como a pessoa vai enxergar.'
            : cliente
              ? 'Sua opinião nos ajuda a melhorar o nosso atendimento.'
              : 'Ela ajuda a melhorar o ambiente de trabalho.'}
        </Text>
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
    setIndice((i) => Math.min(i + 1, totalPassos - 1));
  }

  function voltar() {
    setAviso('');
    setErroEnvio('');
    setErrosContato({});
    setIndice((i) => Math.max(i - 1, 0));
  }

  async function enviar() {
    if (emAndamento.current) return;
    if (pergunta) {
      const bloqueio = bloqueioDeAvanco(pergunta, respostas[pergunta.id]);
      if (bloqueio) { setAviso(bloqueio); return; }
    }
    const pendente = primeiraObrigatoriaPendente(perguntas, respostas);
    if (pendente >= 0) {
      setIndice(pendente);
      setAviso('Esta pergunta é obrigatória. Responda para enviar.');
      return;
    }
    // Contato: sem consentimento é ignorado (nada vai); com consentimento precisa estar correto.
    const validacao = validarContato(contato);
    if (!validacao.ok) { setErrosContato(validacao.erros); return; }
    setErrosContato({});

    emAndamento.current = true;
    setEnviando(true);
    setErroEnvio('');
    try {
      await onEnviar(montarRespostas(perguntas, respostas), respostas, cliente ? montarContato(contato) : null);
      setEnviado(true);
    } catch (e: unknown) {
      setErroEnvio(mensagemDeErro(e));
    } finally {
      emAndamento.current = false;
      setEnviando(false);
    }
  }

  const resposta = pergunta ? respostas[pergunta.id] : undefined;
  const texto = resposta?.text ?? '';
  const jaRespondida = pergunta ? estaRespondida(pergunta, resposta) : false;

  return (
    <View style={styles.raiz}>
      {previa ? <View style={styles.faixaPrevia}><Text style={styles.faixaPreviaTexto}>Prévia: nada é enviado.</Text></View> : null}
      <Text style={styles.marca}>{cliente ? pesquisa.title : `SuperRH · ${pesquisa.title}`}</Text>
      <View style={styles.progressoLinha}>
        <Text accessibilityLiveRegion="polite" style={styles.progressoTexto}>
          {noContato ? 'Último passo' : `Pergunta ${indice + 1} de ${perguntas.length}`}
        </Text>
        {pergunta && !pergunta.required ? <Text style={styles.opcional}>opcional</Text> : null}
        {noContato ? <Text style={styles.opcional}>opcional</Text> : null}
      </View>
      <ProgressBar accessibilityLabel={noContato ? 'Último passo' : `Pergunta ${indice + 1} de ${perguntas.length}`} tone="accent" value={((indice + 1) / totalPassos) * 100} />

      {noContato ? (
        <PassoContato contato={contato} desabilitado={enviando} erros={errosContato} onChange={(c) => { setErrosContato({}); setContato(c); }} />
      ) : pergunta ? (
        <>
          <Text accessibilityRole="header" style={styles.pergunta}>{pergunta.question}</Text>

          {pergunta.type === 'scale' ? <EscalaResposta onChange={responder} pergunta={pergunta} resposta={resposta} /> : null}
          {pergunta.type === 'nps' ? <NpsResposta onChange={responder} pergunta={pergunta} resposta={resposta} /> : null}
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
                <View style={styles.anonimatoTextos}>
                  {cliente ? <Text style={styles.anonimatoTexto}>{AVISO_CLIENTE}</Text> : null}
                  <Text style={styles.anonimatoTexto}>{cliente ? 'Sua resposta é anônima.' : AVISO_ANONIMATO}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {aviso ? <Text accessibilityRole="alert" style={styles.aviso}>{aviso}</Text> : null}
      {erroEnvio ? <Text accessibilityRole="alert" style={styles.aviso}>{erroEnvio}</Text> : null}

      <View style={styles.botoes}>
        <Button accessibilityLabel="Voltar para a pergunta anterior" disabled={indice === 0 || enviando} icon="arrow-back-outline" label="Voltar" onPress={voltar} style={styles.botao} variant="secondary" />
        {ultimoPasso
          ? <Button accessibilityLabel="Enviar respostas" disabled={enviando} icon="send-outline" label="Enviar respostas" loading={enviando} onPress={enviar} style={styles.botao} />
          : <Button accessibilityLabel="Próxima pergunta" disabled={enviando} label={pergunta && !pergunta.required && !jaRespondida ? 'Pular' : 'Próxima'} onPress={proxima} style={styles.botao} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: espaco.lg },
  centro: { alignItems: 'center', gap: espaco.md, paddingVertical: espaco.secao },
  sucessoIcone: { alignItems: 'center', backgroundColor: cores.status.sucesso.superficie, borderRadius: raio.pill, height: espaco.secao, justifyContent: 'center', width: espaco.secao },
  titulo: { ...tipografia.titulo, color: cores.texto.primario, textAlign: 'center' },
  subtitulo: { ...tipografia.corpo, color: cores.texto.discreto, maxWidth: 360 },
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
  nps: { gap: espaco.sm },
  npsGrade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  npsBotao: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, justifyContent: 'center', minHeight: tamanho.toqueMinimo + espaco.md },
  // 11 botões: em tela larga uma linha só; em tela estreita 2 linhas (6 + 5) com botões grandes.
  npsBotaoLinha: { flex: 1, minWidth: 0 },
  npsBotaoDuasLinhas: { flexBasis: '14%', flexGrow: 1, minWidth: 48 },
  npsNumero: { ...tipografia.subtitulo, color: cores.texto.primario },
  npsRotulos: { flexDirection: 'row', justifyContent: 'space-between' },
  npsRotulo: { ...tipografia.legenda, color: cores.texto.discreto },
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
  anonimatoTextos: { flex: 1, gap: espaco.xs },
  anonimatoTexto: { ...tipografia.legenda, color: cores.texto.secundario },
  contato: { gap: espaco.md },
  consentimento: { alignItems: 'flex-start', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo + espaco.md, padding: espaco.md },
  consentimentoAtivo: { backgroundColor: cores.accent.superficie, borderColor: cores.accent.dourado },
  caixa: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.controle, borderWidth: 2, height: espaco.xl, justifyContent: 'center', width: espaco.xl },
  caixaMarcada: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  consentimentoTexto: { flex: 1, gap: espaco.micro },
  consentimentoTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  consentimentoFinalidade: { ...tipografia.legenda, color: cores.texto.secundario },
  camposContato: { gap: espaco.md },
  camposDesligados: { opacity: 0.5 },
  aviso: { ...tipografia.corpo, color: cores.status.erro.forte },
  botoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm },
  botao: { flex: 1 },
});
