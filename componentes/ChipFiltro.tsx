// ============================================================
// componentes/ChipFiltro.tsx — SuperRH
// Chip de filtro (Equipe, Férias): a OPÇÃO só muda cor/texto/aria; o fundo que destaca a selecionada é o indicador
// que desliza do SeletorDeslizante (por isso o fundo do chip é transparente). Usa o "pressionado" único do app.
// ============================================================

import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { usePressEscala } from './pressionar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ChipFiltroProps = {
  label: string;
  ativo: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  /** true = altura mínima de toque (44 px), como os botões de aba de Férias. */
  grande?: boolean;
};

/** Estilo do indicador que desliza sob o chip selecionado (use em <SeletorDeslizante estiloIndicador>). */
export const estiloIndicadorDoChip = { backgroundColor: theme.accent.sutil, borderRadius: raio.pill } as const;

export function ChipFiltro({ label, ativo, onPress, accessibilityLabel, grande = false }: ChipFiltroProps) {
  const press = usePressEscala();
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      aria-pressed={ativo}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.chip, grande && styles.grande, ativo && styles.ativo, press.estilo]}
    >
      <Text style={[styles.texto, ativo && styles.textoAtivo]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', borderColor: theme.bordaSemantica.sutil, borderRadius: raio.pill, borderWidth: borda.fina, justifyContent: 'center', paddingHorizontal: espaco.md, paddingVertical: espaco.xs },
  grande: { minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.lg },
  ativo: { borderColor: theme.accent.borda },
  texto: { ...tipografia.legenda, color: theme.texto.discreto },
  textoAtivo: { color: theme.accent.douradoProfundo },
});
