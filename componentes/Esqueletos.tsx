// ============================================================
// componentes/Esqueletos.tsx — SuperRH
// Peças de esqueleto com o MESMO desenho do conteúdo (fluidez F3): cabeçalho, linha de lista, cartão de
// indicador e título de seção usam as mesmas medidas (tipografia/espaco) das peças reais, então a troca
// esqueleto → conteúdo não muda altura nem estrutura. O grupo anuncia "Carregando" uma vez só (as barras
// internas são decorativas para o leitor de tela).
// ============================================================

import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { Skeleton } from './Skeleton';

type GrupoProps = PropsWithChildren<{ rotulo?: string; style?: StyleProp<ViewStyle> }>;

/** Contêiner de um esqueleto: um único "Carregando…" para o leitor de tela. */
export function EsqueletoGrupo({ rotulo = 'Carregando conteúdo', style, children }: GrupoProps) {
  return <View accessibilityLabel={rotulo} accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={style}>{children}</View>;
}

/** Barra de texto com a altura de uma linha da tipografia (a barra é um pouco mais baixa que a linha, centralizada). */
export function EsqueletoTexto({ linha, largura = '60%' }: { linha: keyof typeof tipografia; largura?: `${number}%` | number }) {
  const altura = tipografia[linha].lineHeight;
  return (
    <View style={{ height: altura, justifyContent: 'center' }}>
      <Skeleton borderRadius={raio.controle} decorativo height={Math.round(altura * 0.6)} width={largura} />
    </View>
  );
}

/** Igual ao ScreenHeader: título (display) + subtítulo (corpo, 4 px abaixo). */
export function EsqueletoCabecalho({ larguraTitulo = '34%', larguraSubtitulo = '58%' }: { larguraTitulo?: `${number}%`; larguraSubtitulo?: `${number}%` }) {
  return (
    <View>
      <EsqueletoTexto largura={larguraTitulo} linha="display" />
      <View style={{ marginTop: espaco.xs }}><EsqueletoTexto largura={larguraSubtitulo} linha="corpo" /></View>
    </View>
  );
}

/** Título de seção (subtitulo) + linha de descrição opcional, como o componente Section. */
export function EsqueletoTituloSecao({ largura = '30%' }: { largura?: `${number}%` }) {
  return <EsqueletoTexto largura={largura} linha="subtitulo" />;
}

/** Seção: título (e descrição opcional) + conteúdo, com o mesmo espaçamento do componente Section (gap md). */
export function EsqueletoSecao({ largura = '30%', descricao = false, children }: PropsWithChildren<{ largura?: `${number}%`; descricao?: boolean }>) {
  return (
    <View style={{ gap: espaco.md }}>
      <View>
        <EsqueletoTexto largura={largura} linha="subtitulo" />
        {descricao ? <View style={{ marginTop: espaco.xs }}><EsqueletoTexto largura="46%" linha="corpo" /></View> : null}
      </View>
      {children}
    </View>
  );
}

/** Linha de lista: avatar (ou ícone) + título + descrição + marcador à direita; mesmo espaçamento das linhas reais. */
export function EsqueletoLinha({ avatar = true, descricao = true, horizontal = espaco.lg, borda: comBorda = true, comBotao = false }: { avatar?: boolean; descricao?: boolean; horizontal?: number; borda?: boolean; comBotao?: boolean }) {
  return (
    <View style={[styles.linha, { paddingHorizontal: horizontal }, !comBorda && styles.semBorda]} testID="esq-linha">
      {avatar ? <Skeleton borderRadius={tamanho.avatarMedio / 2} decorativo height={tamanho.avatarMedio} width={tamanho.avatarMedio} /> : null}
      <View style={styles.copia}>
        <EsqueletoTexto largura="52%" linha="corpoForte" />
        {descricao ? <EsqueletoTexto largura="34%" linha="legenda" /> : null}
      </View>
      {/* À direita: etiqueta de status e, em listas com ação (Equipe), o botão logo abaixo, como nas linhas reais. */}
      <View style={{ alignItems: 'flex-end', gap: espaco.xs }}>
        <Skeleton borderRadius={raio.pill} decorativo height={22} width={64} />
        {comBotao ? <Skeleton borderRadius={raio.controle} decorativo height={tamanho.toqueMinimo} width={88} /> : null}
      </View>
    </View>
  );
}

/** Cartão de métrica (MetricCard): rótulo, número grande e detalhe, com o tamanho do conteúdo (não estica). */
export function EsqueletoMetrica({ largura = 128 }: { largura?: number }) {
  return (
    <View style={[styles.cartao, { width: largura }]} testID="esq-indicador">
      <View style={{ gap: espaco.xs, minHeight: tamanho.toqueMinimo }}>
        <EsqueletoTexto largura="40%" linha="legenda" />
        <EsqueletoTexto largura="24%" linha="titulo" />
        <EsqueletoTexto largura="60%" linha="legenda" />
      </View>
    </View>
  );
}

/** Cartão de indicador do Dashboard: título + etiqueta, número grande, descrição e barra/ação. */
export function EsqueletoCartaoIndicador({ comBarra = true }: { comBarra?: boolean }) {
  return (
    <View style={[styles.cartao, { flex: 1 }]} testID="esq-indicador">
      <View style={styles.cartaoTopo}>
        <EsqueletoTexto largura="40%" linha="corpoForte" />
        <Skeleton borderRadius={raio.pill} decorativo height={22} width={96} />
      </View>
      <EsqueletoTexto largura="18%" linha="titulo" />
      <EsqueletoTexto largura="56%" linha="legenda" />
      {comBarra ? <Skeleton borderRadius={raio.pill} decorativo height={tamanho.barraProgresso} /> : <View style={{ height: tamanho.toqueMinimo }} />}
    </View>
  );
}

/** Cartão genérico (borda e raio iguais ao Card) com N linhas de lista dentro. */
export function EsqueletoCartaoLista({ linhas = 3, avatar = true }: { linhas?: number; avatar?: boolean }) {
  return (
    <View style={styles.cartaoLista} testID="esq-cartao-lista">
      {Array.from({ length: linhas }, (_, i) => <EsqueletoLinha avatar={avatar} borda={i < linhas - 1} horizontal={espaco.md} key={i} />)}
    </View>
  );
}

/** Cartão de conteúdo (aviso, feedback, etc.): título, duas linhas de texto e rodapé. */
export function EsqueletoCartaoTexto({ linhas = 2, alturaMinima }: { linhas?: number; alturaMinima?: number }) {
  return (
    <View style={[styles.cartao, alturaMinima ? { minHeight: alturaMinima } : null]} testID="esq-cartao-texto">
      <EsqueletoTexto largura="46%" linha="subtitulo" />
      {Array.from({ length: linhas }, (_, i) => <EsqueletoTexto key={i} largura={i === linhas - 1 ? '62%' : '92%'} linha="corpo" />)}
      <EsqueletoTexto largura="24%" linha="legenda" />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { alignItems: 'center', borderBottomColor: theme.bordaSemantica.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, paddingVertical: espaco.md },
  semBorda: { borderBottomWidth: 0 },
  copia: { flex: 1, gap: espaco.micro },
  cartao: { backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.sutil, borderRadius: raio.cartao, borderWidth: borda.fina, gap: espaco.md, padding: espaco.lg },
  cartaoTopo: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm, justifyContent: 'space-between' },
  cartaoLista: { backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.sutil, borderRadius: raio.cartao, borderWidth: borda.fina, overflow: 'hidden' },
});
