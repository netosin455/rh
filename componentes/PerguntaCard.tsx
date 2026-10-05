// ============================================================
// componentes/PerguntaCard.tsx — SuperRH
// Cartão numerado de UMA pergunta no editor de pesquisa (RH).
// Tipo em 3 botões grandes, opções com Enter, mover/duplicar/excluir, obrigatória.
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import {
  ErrosPergunta,
  MAX_OPCOES,
  MAX_TEXTO,
  PerguntaRascunho,
  TIPOS_PERGUNTA,
  SEM_RESTRICAO,
  RestricaoPergunta,
  adicionarOpcao,
  editarOpcao,
  opcaoEditavel,
  podeAdicionarOpcao,
  removerOpcao,
  trocarTipo,
} from '../helpers/pesquisa';
import type { SurveyType } from '../tipos/modelos';
import { Button } from './Button';
import { Input } from './Input';

const ICONES_TIPO: Record<SurveyType, keyof typeof Ionicons.glyphMap> = {
  scale: 'stats-chart-outline',
  choice: 'list-outline',
  text: 'create-outline',
  nps: 'speedometer-outline',
};

type PerguntaCardProps = {
  indice: number;
  total: number;
  pergunta: PerguntaRascunho;
  erros?: ErrosPergunta;
  desabilitado?: boolean;
  podeDuplicar: boolean;
  /** Edição de pesquisa com respostas: o que o servidor bloquearia fica desabilitado, com explicação. */
  restricao?: RestricaoPergunta;
  /** Posição permitida para subir/descer (padrão: só os limites da lista). */
  podeSubir?: boolean;
  podeDescer?: boolean;
  /** Tipos de pergunta oferecidos (cada área tem os seus). Padrão: todos. */
  tipos?: readonly SurveyType[];
  onChange: (pergunta: PerguntaRascunho) => void;
  onMover: (delta: -1 | 1) => void;
  onDuplicar: () => void;
  onExcluir: () => void;
};

export function PerguntaCard({ indice, total, pergunta, erros, desabilitado, podeDuplicar, restricao = SEM_RESTRICAO, podeSubir = true, podeDescer = true, tipos, onChange, onMover, onDuplicar, onExcluir }: PerguntaCardProps) {
  const { width } = useWindowDimensions();
  const estreito = width < 640;
  const campos = useRef<(TextInput | null)[]>([]);
  // Índice da opção que deve receber foco depois de adicionada (Enter na última).
  const focoPendente = useRef<number | null>(null);

  useEffect(() => {
    if (focoPendente.current != null) {
      campos.current[focoPendente.current]?.focus();
      focoPendente.current = null;
    }
  }, [pergunta.options.length]);

  function aoDarEnter(i: number) {
    if (i < pergunta.options.length - 1) { campos.current[i + 1]?.focus(); return; }
    if (podeAdicionarOpcao(pergunta)) {
      focoPendente.current = pergunta.options.length;
      onChange(adicionarOpcao(pergunta));
    }
  }

  return (
    <View accessibilityLabel={`Pergunta ${indice + 1} de ${total}`} style={styles.card}>
      <View style={styles.cabecalho}>
        <View style={styles.numero}><Text style={styles.numeroTexto}>{indice + 1}</Text></View>
        <Text style={styles.cabecalhoTitulo}>Pergunta {indice + 1}</Text>
        <View style={styles.acoes}>
          <Button accessibilityLabel={`Subir pergunta ${indice + 1}`} disabled={desabilitado || indice === 0 || !podeSubir} icon="arrow-up-outline" onPress={() => onMover(-1)} variant="ghost" />
          <Button accessibilityLabel={`Descer pergunta ${indice + 1}`} disabled={desabilitado || indice === total - 1 || !podeDescer} icon="arrow-down-outline" onPress={() => onMover(1)} variant="ghost" />
          <Button accessibilityLabel={`Duplicar pergunta ${indice + 1}`} disabled={desabilitado || !podeDuplicar || restricao.duplicar} icon="copy-outline" onPress={onDuplicar} variant="ghost" />
          <Button accessibilityLabel={`Excluir pergunta ${indice + 1}`} disabled={desabilitado || total <= 1 || restricao.remover} icon="trash-outline" onPress={onExcluir} variant="ghost" />
        </View>
      </View>

      {restricao.motivo ? <Text style={styles.motivo}>{restricao.motivo}</Text> : null}

      <Text style={styles.rotulo}>Como a pessoa vai responder?</Text>
      <View accessibilityRole="radiogroup" style={[styles.tipos, estreito && styles.tiposEstreito]}>
        {/* A ordem dos botões segue a ordem da área (no NPS, a nota 0 a 10 vem primeiro). */}
        {(tipos ? tipos.map((tipo) => TIPOS_PERGUNTA.find((t) => t.tipo === tipo)) : TIPOS_PERGUNTA).flatMap((t) => (t ? [t] : [])).map((t) => {
          const ativo = pergunta.type === t.tipo;
          return (
            <Pressable
              accessibilityLabel={t.titulo}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo, disabled: desabilitado || restricao.tipo }}
              aria-checked={ativo}
              disabled={desabilitado || restricao.tipo}
              key={t.tipo}
              onPress={() => onChange(trocarTipo(pergunta, t.tipo))}
              style={[styles.tipo, estreito && styles.tipoEstreito, ativo && styles.tipoAtivo]}
            >
              <Ionicons color={ativo ? cores.texto.sobreAccent : cores.accent.douradoProfundo} name={ICONES_TIPO[t.tipo]} size={tamanho.iconeGrande} />
              <View style={styles.tipoTexto}>
                <Text style={[styles.tipoTitulo, ativo && styles.tipoTituloAtivo]}>{t.titulo}</Text>
                <Text style={[styles.tipoExplicacao, ativo && styles.tipoExplicacaoAtiva]}>{t.explicacao}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Input
        accessibilityLabel={`Texto da pergunta ${indice + 1}`}
        editable={!desabilitado}
        error={erros?.question}
        inputStyle={styles.multilinha}
        label="Pergunta"
        multiline
        onChangeText={(v) => onChange({ ...pergunta, question: v })}
        placeholder="Ex.: Como você avalia o ambiente de trabalho esta semana?"
        textAlignVertical="top"
        value={pergunta.question}
      />

      {pergunta.type === 'choice' ? (
        <View style={styles.opcoes}>
          <Text style={styles.rotulo}>Opções de resposta ({pergunta.options.length} de {MAX_OPCOES})</Text>
          {pergunta.options.map((opcao, i) => (
            <View key={i} style={styles.opcaoLinha}>
              <Input
                accessibilityLabel={`Opção ${i + 1} da pergunta ${indice + 1}`}
                blurOnSubmit={false}
                containerStyle={styles.opcaoCampo}
                editable={!desabilitado && opcaoEditavel(restricao, i)}
                error={erros?.opcao?.[i]}
                label={`Opção ${i + 1}`}
                onChangeText={(v) => onChange(editarOpcao(pergunta, i, v))}
                onSubmitEditing={() => aoDarEnter(i)}
                placeholder="Digite a opção"
                ref={(el) => { campos.current[i] = el; }}
                returnKeyType="next"
                value={opcao}
              />
              <Button accessibilityLabel={`Remover opção ${i + 1}`} disabled={desabilitado || pergunta.options.length <= 2 || !opcaoEditavel(restricao, i)} icon="close-outline" onPress={() => onChange(removerOpcao(pergunta, i))} style={styles.opcaoRemover} variant="ghost" />
            </View>
          ))}
          {erros?.opcoes ? <Text accessibilityRole="alert" style={styles.erro}>{erros.opcoes}</Text> : null}
          {podeAdicionarOpcao(pergunta)
            ? <Button accessibilityLabel={`Adicionar opção na pergunta ${indice + 1}`} disabled={desabilitado} icon="add-outline" label="Adicionar opção" onPress={() => { focoPendente.current = pergunta.options.length; onChange(adicionarOpcao(pergunta)); }} style={styles.adicionarOpcao} variant="secondary" />
            : <Text style={styles.dica}>Limite de {MAX_OPCOES} opções atingido.</Text>}
        </View>
      ) : null}

      {pergunta.type === 'nps' ? (
        <Text style={styles.dica}>A pessoa escolhe uma nota de 0 (nada provável) a 10 (muito provável). O NPS é calculado automaticamente nos resultados.</Text>
      ) : null}

      {pergunta.type === 'text' ? (
        <Text style={styles.dica}>A pessoa poderá escrever até {MAX_TEXTO} caracteres. Avisaremos que a resposta é anônima e para não escrever nomes.</Text>
      ) : null}

      <View style={styles.obrigatoria}>
        <View style={styles.obrigatoriaTexto}>
          <Text style={styles.obrigatoriaTitulo}>Obrigatória</Text>
          <Text style={styles.dica}>{pergunta.required ? 'A pessoa precisa responder para continuar.' : 'A pessoa pode pular esta pergunta.'}</Text>
        </View>
        <Switch
          accessibilityLabel={`Pergunta ${indice + 1} obrigatória`}
          disabled={desabilitado || (restricao.obrigatoria && !pergunta.required)}
          onValueChange={(v) => onChange({ ...pergunta, required: v })}
          trackColor={{ false: cores.borda.forte, true: cores.accent.dourado }}
          value={pergunta.required}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: cores.superficie.elevada, borderColor: cores.borda.sutil, borderRadius: raio.cartao, borderWidth: borda.fina, gap: espaco.lg, padding: espaco.lg },
  cabecalho: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  numero: { alignItems: 'center', backgroundColor: cores.accent.dourado, borderRadius: raio.pill, height: espaco.xxl, justifyContent: 'center', width: espaco.xxl },
  numeroTexto: { ...tipografia.corpoForte, color: cores.texto.sobreAccent },
  // flexBasis: no celular os 4 botões descem para a linha de baixo em vez de quebrar o título.
  cabecalhoTitulo: { ...tipografia.subtitulo, color: cores.texto.primario, flexBasis: 120, flexGrow: 1 },
  acoes: { flexDirection: 'row' },
  rotulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  tipos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  tiposEstreito: { flexDirection: 'column' },
  tipo: { alignItems: 'flex-start', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, flex: 1, gap: espaco.sm, minHeight: tamanho.toqueMinimo + espaco.xxl, minWidth: 140, padding: espaco.md },
  tipoEstreito: { alignItems: 'center', flexDirection: 'row', flex: 0 },
  tipoAtivo: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  tipoTexto: { flex: 1, gap: espaco.micro },
  tipoTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  tipoTituloAtivo: { color: cores.texto.sobreAccent },
  tipoExplicacao: { ...tipografia.legenda, color: cores.texto.discreto },
  tipoExplicacaoAtiva: { color: cores.texto.sobreAccent },
  multilinha: { minHeight: espaco.secao },
  opcoes: { gap: espaco.sm },
  opcaoLinha: { alignItems: 'flex-start', flexDirection: 'row', gap: espaco.xs },
  opcaoCampo: { flex: 1, minWidth: 0 },
  opcaoRemover: { marginTop: espaco.xl },
  adicionarOpcao: { alignSelf: 'flex-start' },
  erro: { ...tipografia.legenda, color: cores.status.erro.forte },
  motivo: { ...tipografia.legenda, backgroundColor: cores.accent.superficie, borderRadius: raio.controle, color: cores.texto.secundario, padding: espaco.sm },
  dica: { ...tipografia.legenda, color: cores.texto.discreto },
  obrigatoria: { alignItems: 'center', borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, flexDirection: 'row', gap: espaco.md, paddingTop: espaco.md },
  obrigatoriaTexto: { flex: 1, gap: espaco.micro },
  obrigatoriaTitulo: { ...tipografia.corpoForte, color: cores.texto.primario },
});
