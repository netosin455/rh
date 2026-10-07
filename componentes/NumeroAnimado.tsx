// ============================================================
// componentes/NumeroAnimado.tsx — SuperRH
// Número que conta até o valor (fluidez F3): do valor anterior ao novo em ~500 ms, easing out.
//  - anima quando o valor MUDA ou na 1ª aparição vinda de esqueleto; revisita com cache aparece pronto;
//  - formatação final exata (helpers/contagem.ts), pt-BR; os intermediários respeitam as casas decimais;
//  - acessibilidade: o contêiner leva o valor FINAL no aria-label desde o 1º frame e o texto animado fica
//    escondido do leitor de tela (ele nunca lê um valor intermediário);
//  - reduzir movimento: o valor aparece imediato; o layout não muda (mesmo Text, sem largura animada).
// ============================================================

import { useContext, useEffect, useRef, useState } from 'react';
import { StyleProp, TextStyle, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { VindoDeEsqueletoContexto } from '../contextos/VindoDeEsqueleto';
import { FormatoContagem, DURACAO_CONTAGEM_MS, formatarContagem, pontoDePartida, progressoDaContagem, valorDaContagem } from '../helpers/contagem';
import { dial, useMotion } from '../estilo/movimento';

type NumeroAnimadoProps = {
  valor: number;
  formato?: FormatoContagem;
  style?: StyleProp<TextStyle>;
  /** Sobrepõe o contexto (use quando a tela não usa Revelar). */
  vindoDeEsqueleto?: boolean;
  testID?: string;
  /** Cor do número; ao mudar (ex.: faixa do NPS) a troca é suave (300 ms). */
  cor?: string;
  /** Rótulo para leitor de tela; o padrão é o próprio valor final formatado. */
  rotulo?: string;
};

export function NumeroAnimado({ valor, formato, style, vindoDeEsqueleto, cor, rotulo, testID }: NumeroAnimadoProps) {
  const motion = useMotion();
  const reduz = motion.reduzMovimento;
  const doContexto = useContext(VindoDeEsqueletoContexto);
  const vindo = vindoDeEsqueleto ?? doContexto;
  const decimais = formato?.decimais ?? 0;
  // Decidido na montagem: um número que já estava na tela não "reaparece" depois.
  const vindoNaMontagem = useRef(vindo);
  const anterior = useRef<number | undefined>(undefined);
  const [mostrado, setMostrado] = useState<number>(() => pontoDePartida({ anterior: undefined, novo: valor, vindoDeEsqueleto: vindo, reduzMovimento: reduz }) ?? valor);
  const mostradoRef = useRef(mostrado);
  mostradoRef.current = mostrado;

  useEffect(() => {
    const de = pontoDePartida({ anterior: anterior.current === undefined ? undefined : mostradoRef.current, novo: valor, vindoDeEsqueleto: vindoNaMontagem.current, reduzMovimento: reduz });
    anterior.current = valor;
    if (de === null) { setMostrado(valor); return undefined; }

    let quadro = 0;
    const inicio = Date.now();
    const passo = () => {
      const t = progressoDaContagem(Date.now() - inicio, DURACAO_CONTAGEM_MS, reduz);
      setMostrado(valorDaContagem(de, valor, t, decimais));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    setMostrado(de);
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, reduz, decimais]);

  const corAnimada = useSharedValue(cor ?? '');
  useEffect(() => {
    if (!cor) return;
    corAnimada.value = reduz ? cor : withTiming(cor, { duration: dial.corMs });
  }, [cor, reduz, corAnimada]);
  const estiloCor = useAnimatedStyle(() => (cor ? { color: corAnimada.value } : {}));

  const final = formatarContagem(valor, formato);
  return (
    <View accessibilityLabel={rotulo ?? final} accessibilityRole="text" testID={testID}>
      <Animated.Text
        accessibilityElementsHidden
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[style, estiloCor]}
      >
        {formatarContagem(mostrado, formato)}
      </Animated.Text>
    </View>
  );
}
