import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Modal as NativeModal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../estilo/cores';
import { borda, elevacao, espaco, largura, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { movimento, useMotion } from '../estilo/movimento';

type AppModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export function AppModal({ visible, title, subtitle, onClose, footer, children }: AppModalProps) {
  const motion = useMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: motion.duracao('normal'), easing: motion.entrada });
      return;
    }

    progress.value = withTiming(0, { duration: motion.duracao('fast'), easing: motion.saida }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [motion, progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const modalStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: motion.reduzMovimento ? 1 : movimento.deslocamento.modal + (1 - movimento.deslocamento.modal) * progress.value }],
  }));

  if (!mounted) return null;

  return (
    <NativeModal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Animated.View accessibilityViewIsModal style={[styles.modal, modalStyle]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar modal" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={tamanho.iconeMedio} color={theme.texto.discreto} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </Animated.View>
    </NativeModal>
  );
}

export { AppModal as Modal };

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: theme.elevacao.backdrop, flex: 1, justifyContent: 'center', padding: espaco.xl },
  modal: { ...elevacao.overlay, backgroundColor: theme.superficie.elevada, borderColor: theme.bordaSemantica.sutil, borderRadius: raio.overlay, borderWidth: borda.fina, maxWidth: largura.leitura, shadowColor: theme.elevacao.sombra, width: '100%' },
  header: { alignItems: 'flex-start', borderBottomColor: theme.bordaSemantica.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', gap: espaco.md, padding: espaco.lg },
  headerCopy: { flex: 1 },
  title: { ...tipografia.titulo, color: theme.texto.primario },
  subtitle: { ...tipografia.corpo, color: theme.texto.discreto, marginTop: espaco.micro },
  close: { alignItems: 'center', height: tamanho.toqueMinimo, justifyContent: 'center', marginTop: -espaco.sm, marginRight: -espaco.sm, width: tamanho.toqueMinimo },
  body: { padding: espaco.lg },
  footer: { borderTopColor: theme.bordaSemantica.sutil, borderTopWidth: borda.fina, padding: espaco.lg },
});
