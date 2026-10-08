import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { dial, movimento } from '../estilo/movimento';
import { usePressEscala } from './pressionar';
import { elevacaoDoRealce, useRealce } from './realce';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardProps = PropsWithChildren<ViewProps> & {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Card({ children, style, padded = true, onPress, accessibilityLabel, ...props }: CardProps) {
  const press = usePressEscala();
  const [focused, setFocused] = useState(false);
  const realce = useRealce(raio.cartao);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: elevacaoDoRealce(realce.hover) }, { scale: withTiming(press.pressionado.value && !press.reduz ? press.alvo : 1, {
      duration: dial.pressMs,
      easing: movimento.curva.entrada,
    }) }],
  }));

  const cardStyle = [styles.card, padded && styles.padded, onPress && styles.clickable, focused && styles.focus, style];

  if (onPress) {
    return (
      <AnimatedPressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Abrir cartão'}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={realce.onHoverIn}
        onHoverOut={realce.onHoverOut}
        style={[cardStyle, animatedStyle]}
      >
        {realce.camada}
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View {...props} style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.superficie.elevada,
    borderColor: theme.bordaSemantica.sutil,
    borderRadius: raio.cartao,
    borderWidth: borda.fina,
  },
  padded: { padding: espaco.lg },
  clickable: { minHeight: tamanho.toqueMinimo },
  focus: { borderColor: theme.foco.anel, borderWidth: borda.foco },
});
