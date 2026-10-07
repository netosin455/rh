// ============================================================
// componentes/Revelar.tsx — SuperRH
// Troca o esqueleto pelo conteúdo com crossfade de 150 ms, SEM salto de layout (fluidez F2).
//  - o esqueleto fica em camada absoluta por cima (pointerEvents none: nunca bloqueia clique) e some com fade;
//  - o conteúdo ocupa o espaço normalmente e entra com fade de 150 ms;
//  - com dado em cache (nunca houve esqueleto) o conteúdo aparece direto, no 1º frame, sem animação;
//  - `alturaMinima` mantém a altura de uma seção enquanto ela carrega (use em seções, não em telas inteiras);
//  - com "reduzir movimento" a troca é instantânea.
// ============================================================

import { PropsWithChildren, ReactNode, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { VindoDeEsqueletoContexto } from '../contextos/VindoDeEsqueleto';
import { useMotion } from '../estilo/movimento';

const DURACAO_CROSSFADE_MS = 150;

type RevelarProps = PropsWithChildren<{
  carregando: boolean;
  esqueleto: ReactNode;
  /** true (padrão) = ocupa a tela inteira (flex 1). Em seções, passe false e use alturaMinima. */
  preencher?: boolean;
  alturaMinima?: number;
}>;

export function Revelar({ carregando, esqueleto, preencher = true, alturaMinima, children }: RevelarProps) {
  const motion = useMotion();
  const viuEsqueleto = useRef(false);
  if (carregando) viuEsqueleto.current = true;
  const anima = !motion.reduzMovimento;

  return (
    <VindoDeEsqueletoContexto.Provider value={viuEsqueleto.current}>
    <View style={[preencher ? styles.preencher : null, alturaMinima ? { minHeight: alturaMinima } : null]}>
      {!carregando ? (
        <Animated.View entering={anima && viuEsqueleto.current ? FadeIn.duration(DURACAO_CROSSFADE_MS) : undefined} style={preencher ? styles.preencher : null}>
          {children}
        </Animated.View>
      ) : null}
      {carregando ? (
        <Animated.View exiting={anima ? FadeOut.duration(DURACAO_CROSSFADE_MS) : undefined} pointerEvents="none" style={[styles.camada, preencher ? null : { minHeight: alturaMinima }]}>
          {esqueleto}
        </Animated.View>
      ) : null}
    </View>
    </VindoDeEsqueletoContexto.Provider>
  );
}

const styles = StyleSheet.create({
  preencher: { flex: 1, minHeight: 0 },
  // Por cima do conteúdo, ocupando o mesmo espaço do contêiner.
  camada: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
