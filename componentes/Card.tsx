import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { movimento, useMotion } from '../estilo/movimento';
import { elevacaoDoRealce, useRealce } from './realce';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardProps = PropsWithChildren<ViewProps> & {
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Card({ children, style, padded = true, onPress, accessibilityLabel, ...props }: CardProps) {
  const motion = useMotion();
  const pressed = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const realce = useRealce(raio.cartao);
  const pressDuration = motion.duracao('instant');
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: elevacaoDoRealce(realce.hover) }, { scale: withTiming(pressed.value && !motion.reduzMovimento ? movimento.deslocamento.press : 1, {
      duration: pressDuration,
      easing: motion.entrada,
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
        onPressIn={() => { pressed.value = 1; }}
        onPressOut={() => { pressed.value = 0; }}
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
