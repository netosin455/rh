// ============================================================
// componentes/EntradaTela.tsx — SuperRH
// Transição entre telas (fluidez F2), aplicada UMA vez, no `screenLayout` do Stack e do Tabs:
// nenhuma tela precisa ser editada e nada é remontado. A sidebar fica fora (não anima).
//  - 1ª vez que a rota ganha o foco: opacity 0→1 e deslocamento do dial (10 px, 220 ms);
//  - revisita (tela de aba que volta ao foco, ou rota já vista nesta sessão): só um fade de 120 ms;
//  - dispara no FOCO, não na montagem (telas de aba ficam montadas e escondidas);
//  - só opacity/transform; a tela é interativa desde o 1º frame; com "reduzir movimento" nada anima.
// ============================================================

import { PropsWithChildren, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { aoLimpar } from '../helpers/cacheDados';
import { dial } from '../estilo/dial';
import { movimento, useMotion } from '../estilo/movimento';

const DESLOCAMENTO_TELA_PX = dial.telaPx;
const DURACAO_TELA_MS = dial.telaMs;
const DURACAO_REVISITA_MS = dial.revisitaMs;
/** Rotas que já tiveram foco nesta sessão. Zera junto com o cache (logout/troca de usuário). */
const rotasVistas = new Set<string>();
aoLimpar(() => rotasVistas.clear());

type NavegacaoDaTela = {
  isFocused: () => boolean;
  addListener: (evento: 'focus', callback: () => void) => () => void;
};

type EntradaTelaProps = PropsWithChildren<{ navigation: NavegacaoDaTela; nomeRota: string }>;

export function EntradaTela({ navigation, nomeRota, children }: EntradaTelaProps) {
  const motion = useMotion();
  const reduz = motion.reduzMovimento;
  const opacidade = useSharedValue(1);
  const deslocamento = useSharedValue(0);

  useEffect(() => {
    if (reduz) { opacidade.value = 1; deslocamento.value = 0; return undefined; }

    function animar() {
      const jaVista = rotasVistas.has(nomeRota);
      rotasVistas.add(nomeRota);
      opacidade.value = 0;
      if (jaVista) {
        deslocamento.value = 0;
        opacidade.value = withTiming(1, { duration: DURACAO_REVISITA_MS, easing: motion.entrada });
      } else {
        deslocamento.value = DESLOCAMENTO_TELA_PX;
        opacidade.value = withTiming(1, { duration: DURACAO_TELA_MS, easing: movimento.curva.entradaMarcada });
        deslocamento.value = withTiming(0, { duration: DURACAO_TELA_MS, easing: movimento.curva.entradaMarcada });
      }
    }

    if (navigation.isFocused()) animar();
    const cancelar = navigation.addListener('focus', animar);
    // Trava de segurança: a tela nunca fica presa com opacidade intermediária.
    const garantia = setTimeout(() => { if (opacidade.value < 1) opacidade.value = 1; }, 600);
    return () => { cancelar(); clearTimeout(garantia); };
  }, [navigation, nomeRota, reduz, opacidade, deslocamento, motion.entrada]);

  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.value, transform: [{ translateY: deslocamento.value }] }));
  return <Animated.View style={[{ flex: 1, minHeight: 0 }, estilo]}>{children}</Animated.View>;
}
