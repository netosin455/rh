import { ReactNode, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { elevacaoDoRealce, useRealce } from './realce';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ListRowProps = {
  title: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({ title, description, leading, trailing, onPress, accessibilityLabel, style }: ListRowProps) {
  const [focused, setFocused] = useState(false);
  const realce = useRealce(raio.controle);
  const estiloRealce = useAnimatedStyle(() => ({ transform: [{ translateY: elevacaoDoRealce(realce.hover) }] }));
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text numberOfLines={2} style={styles.description}>{description}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? [title, description].filter(Boolean).join('. ')}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={realce.onHoverIn}
        onHoverOut={realce.onHoverOut}
        onPress={onPress}
        style={[styles.row, styles.pressable, focused && styles.focus, style, estiloRealce]}
      >
        {realce.camada}
        {content}
      </AnimatedPressable>
    );
  }

  return <View accessibilityRole="text" accessibilityLabel={[title, description].filter(Boolean).join('. ')} style={[styles.row, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: theme.bordaSemantica.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, paddingVertical: espaco.md },
  pressable: { paddingHorizontal: espaco.md },
  focus: { backgroundColor: theme.foco.superficie, borderLeftColor: theme.foco.anel, borderLeftWidth: borda.foco },
  leading: { flexShrink: 0 },
  copy: { flex: 1, gap: espaco.micro },
  title: { ...tipografia.corpoForte, color: theme.texto.primario },
  description: { ...tipografia.legenda, color: theme.texto.discreto },
  trailing: { alignItems: 'flex-end', flexShrink: 0 },
});
