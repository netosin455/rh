// ============================================================
// componentes/SeletorDeslizante.tsx — SuperRH
// Indicador que DESLIZA da opção anterior para a nova em filtros e abas (fluidez F4), no lugar da troca seca.
//  - <SeletorDeslizante selecionado="x" modo="fundo|linha|moldura"> envolve as opções;
//  - cada opção é um <ItemDeslizante chave="x"> (mede a própria posição com onLayout; é um filho DIRETO do seletor);
//  - o indicador já nasce na posição certa (a 1ª medição só posiciona, sem animar do zero);
//  - o movimento é translateX/Y (transform) + largura/altura da camada decorativa absoluta (não mexe em nenhum
//    vizinho nem no layout da página); o clique/seleção NÃO espera a animação — o estado muda no 1º frame;
//  - "fundo" fica ATRÁS das opções (elas precisam de fundo transparente); "linha" é um sublinhado; "moldura"
//    fica NA FRENTE (só borda, pointerEvents none) para cartões com fundo próprio;
//  - reduzir movimento: o indicador salta direto; o estado "selecionado" continua no aria/cor/texto da opção.
// ============================================================

import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { dial, movimento, useMotion } from '../estilo/movimento';
import { ModoIndicador, RetanguloItem, retanguloDoIndicador } from '../helpers/microinteracoes';

interface ContextoDoSeletor {
  registrar: (chave: string, retangulo: RetanguloItem) => void;
}

const ContextoSeletor = createContext<ContextoDoSeletor | null>(null);

type SeletorProps = PropsWithChildren<{
  /** Chave da opção selecionada (null = nenhuma: o indicador some). */
  selecionado: string | null;
  modo?: ModoIndicador;
  /** Estilo do indicador (cor de fundo/borda, raio). A posição e o tamanho vêm da medição. */
  estiloIndicador: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function SeletorDeslizante({ selecionado, modo = 'fundo', estiloIndicador, style, testID, children }: SeletorProps) {
  const motion = useMotion();
  const [itens, setItens] = useState<Record<string, RetanguloItem>>({});
  const contexto = useMemo<ContextoDoSeletor>(() => ({
    registrar: (chave, r) => setItens((antes) => {
      const a = antes[chave];
      return a && a.x === r.x && a.y === r.y && a.largura === r.largura && a.altura === r.altura ? antes : { ...antes, [chave]: r };
    }),
  }), []);

  const alvo = retanguloDoIndicador(itens, selecionado, modo);
  const posicionado = useRef(false);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const largura = useSharedValue(0);
  const altura = useSharedValue(0);
  const opacidade = useSharedValue(0);

  useEffect(() => {
    if (!alvo) { posicionado.current = false; opacidade.value = 0; return; }
    // Primeira posição (ou movimento reduzido): vai direto, sem deslizar a partir do zero.
    if (!posicionado.current || motion.reduzMovimento) {
      posicionado.current = true;
      x.value = alvo.x; y.value = alvo.y; largura.value = alvo.largura; altura.value = alvo.altura; opacidade.value = 1;
      return;
    }
    const config = { duration: dial.indicadorMs, easing: movimento.curva.entradaMarcada };
    x.value = withTiming(alvo.x, config);
    y.value = withTiming(alvo.y, config);
    largura.value = withTiming(alvo.largura, config);
    altura.value = withTiming(alvo.altura, config);
    opacidade.value = 1;
  }, [alvo?.x, alvo?.y, alvo?.largura, alvo?.altura, motion.reduzMovimento]); // eslint-disable-line react-hooks/exhaustive-deps

  const estilo = useAnimatedStyle(() => ({
    height: altura.value,
    opacity: opacidade.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: largura.value,
  }));
  const indicador = <Animated.View pointerEvents="none" style={[{ left: 0, position: 'absolute', top: 0 }, estiloIndicador, estilo]} testID={testID ? `${testID}-indicador` : undefined} />;

  return (
    <ContextoSeletor.Provider value={contexto}>
      <View style={[{ position: 'relative' }, style]} testID={testID}>
        {modo !== 'moldura' ? indicador : null}
        {children}
        {modo === 'moldura' ? indicador : null}
      </View>
    </ContextoSeletor.Provider>
  );
}

type ItemProps = PropsWithChildren<{ chave: string; style?: StyleProp<ViewStyle> }>;

/** Uma opção do seletor: mede onde está e informa ao indicador. Deve ser filho DIRETO do SeletorDeslizante. */
export function ItemDeslizante({ chave, style, children }: ItemProps) {
  const contexto = useContext(ContextoSeletor);
  function aoMedir(e: LayoutChangeEvent) {
    const { x, y, width, height } = e.nativeEvent.layout;
    contexto?.registrar(chave, { x, y, largura: width, altura: height });
  }
  return <View onLayout={aoMedir} style={style}>{children}</View>;
}
