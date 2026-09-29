import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Modal as NativeModal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, elevacao, espaco, largura, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { movimento, useMotion } from '../estilo/movimento';

type DrawerSide = 'left' | 'right' | 'bottom';

type DrawerProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title?: string;
  side?: DrawerSide;
  footer?: ReactNode;
}>;

export function Drawer({ visible, onClose, title, side = 'right', footer, children }: DrawerProps) {
  const motion = useMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: motion.duracao('estrutural'), easing: motion.entrada });
      return;
    }

    progress.value = withTiming(0, { duration: motion.duracao('fast'), easing: motion.saida }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [motion, progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() => {
    const displacement = motion.reduzMovimento ? 0 : (1 - progress.value) * movimento.deslocamento.drawer;
    const translateX = side === 'left' ? -displacement : side === 'right' ? displacement : 0;
    const translateY = side === 'bottom' ? displacement : 0;
    return { transform: [{ translateX }, { translateY }] };
  });

  if (!mounted) return null;

  return (
    <NativeModal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={onClose} style={styles.backdropAction} />
        <Animated.View accessibilityViewIsModal style={[styles.panel, side === 'left' && styles.left, side === 'right' && styles.right, side === 'bottom' && styles.bottom, panelStyle]}>
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.headerSpacer} />}
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={onClose} style={styles.close}>
              <Ionicons color={theme.texto.discreto} name="close" size={tamanho.iconeMedio} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </Animated.View>
    </NativeModal>
  );
}

/** Alias explícito para usos em que a folha inferior descreve melhor a ação. */
export const Sheet = Drawer;

const styles = StyleSheet.create({
  backdrop: { backgroundColor: theme.elevacao.backdrop, flex: 1 },
  backdropAction: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  panel: { ...elevacao.overlay, backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.sutil, borderWidth: borda.fina, position: 'absolute', shadowColor: theme.elevacao.sombra },
  left: { borderBottomRightRadius: raio.overlay, borderTopRightRadius: raio.overlay, bottom: espaco.zero, left: espaco.zero, maxWidth: largura.drawer, top: espaco.zero, width: largura.completa },
  right: { borderBottomLeftRadius: raio.overlay, borderTopLeftRadius: raio.overlay, bottom: espaco.zero, maxWidth: largura.drawer, right: espaco.zero, top: espaco.zero, width: largura.completa },
  bottom: { borderTopLeftRadius: raio.overlay, borderTopRightRadius: raio.overlay, bottom: espaco.zero, left: espaco.zero, maxHeight: largura.sheet, right: espaco.zero },
  header: { alignItems: 'center', borderBottomColor: theme.bordaSemantica.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', minHeight: tamanho.toqueMinimo, paddingLeft: espaco.lg },
  headerSpacer: { flex: 1 },
  title: { ...tipografia.subtitulo, color: theme.texto.primario, flex: 1 },
  close: { alignItems: 'center', height: tamanho.toqueMinimo, justifyContent: 'center', width: tamanho.toqueMinimo },
  body: { flexGrow: 1, padding: espaco.lg },
  footer: { borderTopColor: theme.bordaSemantica.sutil, borderTopWidth: borda.fina, padding: espaco.lg },
});
