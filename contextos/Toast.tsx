import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../estilo/cores';
import { borda, camada, elevacao, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { movimento, useMotion } from '../estilo/movimento';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const toastStyle: Record<ToastType, { background: string; border: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { background: theme.status.sucesso.superficie, border: theme.status.sucesso.borda, color: theme.status.sucesso.forte, icon: 'checkmark' },
  error: { background: theme.status.erro.superficie, border: theme.status.erro.borda, color: theme.status.erro.forte, icon: 'close' },
  warning: { background: theme.status.pendente.superficie, border: theme.status.pendente.borda, color: theme.status.pendente.forte, icon: 'alert' },
  info: { background: theme.status.informacao.superficie, border: theme.status.informacao.borda, color: theme.status.informacao.forte, icon: 'information' },
};

function SingleToast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const motion = useMotion();
  const translateY = useSharedValue(motion.reduzMovimento ? 0 : -movimento.deslocamento.toast);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: motion.duracao('normal'), easing: motion.entrada });
    opacity.value = withTiming(1, { duration: motion.duracao('normal'), easing: motion.entrada });

    const timer = setTimeout(() => {
      translateY.value = withTiming(motion.reduzMovimento ? 0 : -movimento.deslocamento.toast, { duration: motion.duracao('fast'), easing: motion.saida });
      opacity.value = withTiming(0, { duration: motion.duracao('fast'), easing: motion.saida }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, movimento.espera.toast);

    return () => clearTimeout(timer);
  }, [motion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const style = toastStyle[item.type];

  return (
    <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.toast, { backgroundColor: style.background, borderColor: style.border }, animatedStyle]}>
      <View style={styles.iconBadge}>
        <Ionicons color={style.color} name={style.icon} size={tamanho.iconePequeno} />
      </View>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
    </Animated.View>
  );
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, type: ToastType) => {
    const id = nextId++;
    setToasts((previous) => [...previous.slice(-2), { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const context: ToastContextType = {
    success: (message) => show(message, 'success'),
    error: (message) => show(message, 'error'),
    warning: (message) => show(message, 'warning'),
    info: (message) => show(message, 'info'),
  };

  return (
    <ToastContext.Provider value={context}>
      {children}
      <View pointerEvents="none" style={[styles.container, { top: insets.top + (Platform.OS === 'android' ? espaco.sm : espaco.xs) }]}>
        {toasts.map((toast) => <SingleToast item={toast} key={toast.id} onDone={() => remove(toast.id)} />)}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  container: { gap: espaco.sm, left: espaco.lg, position: 'absolute', right: espaco.lg, zIndex: camada.toast },
  toast: {
    ...elevacao.overlay,
    alignItems: 'center',
    borderRadius: raio.cartao,
    borderWidth: borda.fina,
    flexDirection: 'row',
    gap: espaco.sm,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.md,
    shadowColor: theme.elevacao.sombra,
  },
  iconBadge: { alignItems: 'center', flexShrink: 0, height: tamanho.iconeGrande, justifyContent: 'center', width: tamanho.iconeGrande },
  message: { ...tipografia.corpo, color: theme.texto.primario, flex: 1 },
});
