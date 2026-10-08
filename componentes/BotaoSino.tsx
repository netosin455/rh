// ============================================================
// componentes/BotaoSino.tsx — SuperRH
// Sino de notificações do topo (fluidez F4): balança UMA vez (±12°, ~400 ms, só transform) quando o contador de
// não lidas SOBE — nunca na montagem, na 1ª leitura nem quando desce. O badge numérico dá o "pop". A ação
// (abrir as notificações) não espera nada. Reduzir movimento: sem balanço nem pop; o número continua lá.
// ============================================================

import { useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { usarSubida } from '../contextos/usarSubida';
import { cores } from '../estilo/cores';
import { espaco, raio } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';
import { passosDoSino } from '../helpers/microinteracoes';
import { tipografia } from '../estilo/tipografia';
import { BadgeContador } from './BadgeContador';
import { Button } from './Button';

type BotaoSinoProps = { naoLidas: number; pronto: boolean; onPress: () => void; style?: StyleProp<ViewStyle> };

export function BotaoSino({ naoLidas, pronto, onPress, style }: BotaoSinoProps) {
  const motion = useMotion();
  const pulso = usarSubida(naoLidas, pronto, true);
  const grau = useSharedValue(0);
  const visto = useRef(pulso);

  useEffect(() => {
    if (pulso === visto.current) return;
    visto.current = pulso;
    if (motion.reduzMovimento) return;
    grau.value = withSequence(...passosDoSino().map((p) => withTiming(p.graus, { duration: p.ms, easing: Easing.inOut(Easing.sin) })));
  }, [pulso, motion.reduzMovimento, grau]);

  const balanco = useAnimatedStyle(() => ({ transform: [{ rotate: `${grau.value}deg` }] }));
  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.balanco, balanco]} testID="sino-notificacoes">
        <Button
          accessibilityLabel={naoLidas > 0 ? `Abrir notificações, ${naoLidas} não lidas` : 'Abrir notificações'}
          icon="notifications-outline"
          onPress={onPress}
          style={style}
          variant="ghost"
        />
      </Animated.View>
      {naoLidas > 0 ? <BadgeContador testID="badge-sino" estilo={styles.badge} estiloTexto={styles.badgeTexto} pulso={pulso} valor={naoLidas} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // O sino balança em torno do topo (como pendurado); o badge fica fora do balanço.
  balanco: { transformOrigin: 'center top' },
  badge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro, position: 'absolute', right: -espaco.xs, top: -espaco.xs },
  badgeTexto: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
});
