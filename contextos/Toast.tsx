// ============================================================
// contextos/Toast.tsx — Sistema de notificações em tela
// ============================================================

import React, {
  createContext, useContext, useState, useCallback, useRef, useEffect,
} from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../estilo/cores';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error:   (message: string) => void;
  warning: (message: string) => void;
  info:    (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const STYLE: Record<ToastType, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: 'rgba(52,211,153,0.13)',  border: theme.success, icon: '✓', color: theme.success },
  error:   { bg: 'rgba(248,113,113,0.13)', border: theme.danger,  icon: '✕', color: theme.danger  },
  warning: { bg: 'rgba(251,191,36,0.13)',  border: theme.warning, icon: '!', color: theme.warning  },
  info:    { bg: 'rgba(96,165,250,0.13)',  border: theme.info,    icon: 'i', color: theme.info     },
};

const DURATION = 3200;
const ANIM_IN  = 280;
const ANIM_OUT = 240;

function SingleToast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: ANIM_IN, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: ANIM_OUT, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: ANIM_OUT, useNativeDriver: true }),
      ]).start(() => onDone());
    }, DURATION);

    return () => clearTimeout(timer);
  }, []);

  const s = STYLE[item.type];

  return (
    <Animated.View style={[styles.toast, { backgroundColor: s.bg, borderColor: s.border, transform: [{ translateY }], opacity }]}>
      <View style={[styles.iconBadge, { backgroundColor: s.border }]}>
        <Text style={styles.iconText}>{s.icon}</Text>
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
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    warning: (msg) => show(msg, 'warning'),
    info:    (msg) => show(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={[styles.container, { top: insets.top + (Platform.OS === 'android' ? 8 : 4) }]} pointerEvents="none">
        {toasts.map(t => (
          <SingleToast key={t.id} item={t} onDone={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  message: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
});
