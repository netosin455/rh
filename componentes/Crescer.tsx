// ============================================================
// componentes/Crescer.tsx — SuperRH
// Barra que cresce do zero até o tamanho final (fluidez F3), só com `transform: scale` — o tamanho do
// layout já nasce o final (CLS 0). Eixo "x" cresce a partir da esquerda, "y" a partir da base.
//  - só anima quando o conteúdo acabou de sair de um esqueleto (nunca em revisita com cache);
//  - 450 ms, escalonável (atrasoMs, use atrasoDaBarra(indice)); termina exatamente em escala 1;
//  - reduzir movimento: já nasce no tamanho final.
// ============================================================

import { useContext, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { VindoDeEsqueletoContexto } from '../contextos/VindoDeEsqueleto';
import { dial, movimento, useMotion } from '../estilo/movimento';

type CrescerProps = {
  eixo: 'x' | 'y';
  atrasoMs?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
};

export function Crescer({ eixo, atrasoMs = 0, style, testID, children }: CrescerProps) {
  const motion = useMotion();
  const vindoDeEsqueleto = useContext(VindoDeEsqueletoContexto);
  const anima = vindoDeEsqueleto && !motion.reduzMovimento;
  const escala = useSharedValue(anima ? 0 : 1);

  useEffect(() => {
    if (!anima) { escala.value = 1; return; }
    escala.value = withDelay(atrasoMs, withTiming(1, { duration: dial.barraMs, easing: movimento.curva.entradaMarcada }));
    // Só na montagem: a barra que já está na tela não recomeça do zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estilo = useAnimatedStyle(() => ({ transform: [eixo === 'x' ? { scaleX: escala.value } : { scaleY: escala.value }] }));
  const origem: ViewStyle = { transformOrigin: eixo === 'x' ? 'left center' : 'center bottom' };
  return <Animated.View style={[origem, style, estilo]} testID={testID}>{children}</Animated.View>;
}
