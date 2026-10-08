// ============================================================
// componentes/ShellSidebar.tsx — SuperRH
// Sidebar única da web larga. Vive no layout raiz para persistir entre todas
// as rotas autenticadas (abas e telas do Stack); item ativo vem só do pathname.
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '../contextos/Autenticacao';
import { useContadoresShell } from '../contextos/Contadores';
import { usarSubida } from '../contextos/usarSubida';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { useMotion } from '../estilo/movimento';
import { tipografia } from '../estilo/tipografia';
import { resolverItemAtivo } from '../helpers/navegacao';
import { prefetchDaRota } from '../helpers/prefetchRotas';
import { CAN_APPROVE, SHELL_GROUPS, ShellNavigationItem, canAccessNavigation } from '../helpers/shellNav';
import { BadgeContador } from './BadgeContador';
import { BrandMark } from './BrandMark';
import { usePressEscala } from './pressionar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ItemLayout = { height: number; y: number };

function SidebarItem({
  active,
  item,
  onLayout,
  onPress,
  onPrefetch,
  pendingCount = 0,
  pulsoPendencias = 0,
}: {
  active: boolean;
  item: ShellNavigationItem;
  onLayout: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  /** Passar o mouse ou focar: pré-carrega o dado da tela de destino (só leitura). */
  onPrefetch?: () => void;
  pendingCount?: number;
  /** Muda quando o contador de pendências muda: o badge dá o "pop". */
  pulsoPendencias?: number;
}) {
  const [focused, setFocused] = useState(false);
  const press = usePressEscala('icone');
  const motion = useMotion();
  const hoverOpacity = useSharedValue(0);
  const icon = (active ? item.icon : `${item.icon}-outline`) as keyof typeof Ionicons.glyphMap;
  const hoverStyle = useAnimatedStyle(() => ({ opacity: hoverOpacity.value }));

  useEffect(() => {
    if (active) hoverOpacity.value = 0;
  }, [active, hoverOpacity]);

  function setHovering(hovered: boolean) {
    if (hovered) onPrefetch?.();
    if (active) return;
    hoverOpacity.value = withTiming(hovered ? 1 : 0, {
      duration: motion.reduzMovimento ? motion.fadeCurto : 120,
      easing: hovered ? motion.entrada : motion.saida,
    });
  }

  return (
    <AnimatedPressable
      accessibilityLabel={`Abrir ${item.title}${pendingCount > 0 ? `, ${pendingCount} pendências` : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onBlur={() => setFocused(false)}
      onFocus={() => { setFocused(true); onPrefetch?.(); }}
      onHoverIn={() => setHovering(true)}
      onHoverOut={() => setHovering(false)}
      onLayout={onLayout}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.sidebarItem, active && styles.sidebarItemActive, focused && styles.sidebarItemFocused, press.estilo]}
    >
      <Animated.View pointerEvents="none" style={[styles.sidebarItemHover, hoverStyle]} />
      <Ionicons color={active ? cores.sidebar.accent : cores.sidebar.textoInativo} name={icon} size={tamanho.iconeMedio} />
      <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>{item.title}</Text>
      {pendingCount > 0 ? <BadgeContador estilo={styles.sidebarPendingBadge} estiloTexto={styles.sidebarPendingBadgeText} pulso={pulsoPendencias} valor={pendingCount} /> : null}
    </AnimatedPressable>
  );
}

export function ShellSidebar() {
  const motion = useMotion();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { pendentes: pendentesCount, pendentesPronto } = useContadoresShell();
  const pulsoPendencias = usarSubida(pendentesCount, pendentesPronto, false);
  // true enquanto a fita está posicionada: no 1º layout (ou ao voltar de "sem item") ela só posiciona, sem deslizar.
  const posicionada = useRef(false);
  // onLayout devolve y relativo ao PAI: guardamos o y do grupo e o do item separados
  // e somamos, senão itens que abrem grupos diferentes teriam o mesmo y e a fita não sairia do lugar.
  const [layouts, setLayouts] = useState<Record<string, ItemLayout>>({});
  const [gruposY, setGruposY] = useState<Record<string, number>>({});
  const indicatorY = useSharedValue(0);
  const indicatorHeight = useSharedValue<number>(tamanho.toqueMinimo);
  const indicatorOpacity = useSharedValue(0);
  const role = user?.role;
  const groups = useMemo(() => SHELL_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessNavigation(item.roles, role)) }))
    .filter((group) => group.items.length > 0), [role]);
  // Fonte única de verdade: o pathname (cobre abas e subrotas como /colaborador/[id]).
  const activeItem = useMemo(() => {
    const itens = groups.flatMap((group) => group.items);
    const key = resolverItemAtivo(pathname, itens);
    return itens.find((item) => item.key === key);
  }, [groups, pathname]);
  const indicatorLayout = useMemo(() => {
    if (!activeItem) return undefined;
    const item = layouts[activeItem.key];
    const grupo = groups.find((g) => g.items.some((i) => i.key === activeItem.key));
    const grupoY = grupo ? gruposY[grupo.title] : undefined;
    if (!item || grupoY === undefined) return undefined;
    return { height: item.height, y: grupoY + item.y };
  }, [activeItem, groups, layouts, gruposY]);

  useEffect(() => {
    // Rota fora da sidebar (ex.: /notificacoes): esconde a fita em vez de deixá-la no item errado.
    if (!indicatorLayout) {
      posicionada.current = false;
      indicatorOpacity.value = withTiming(0, { duration: motion.fadeCurto, easing: motion.saida });
      return;
    }

    // Primeiro posicionamento (ou movimento reduzido): salta direto, sem animar a partir de 0.
    if (!posicionada.current || motion.reduzMovimento) {
      posicionada.current = true;
      indicatorY.value = indicatorLayout.y;
      indicatorHeight.value = indicatorLayout.height;
      indicatorOpacity.value = withTiming(1, { duration: motion.duracao('fast'), easing: motion.entrada });
      return;
    }

    indicatorY.value = withTiming(indicatorLayout.y, { duration: motion.duracao('estrutural'), easing: motion.entrada });
    indicatorHeight.value = withTiming(indicatorLayout.height, { duration: motion.duracao('estrutural'), easing: motion.entrada });
    indicatorOpacity.value = withTiming(1, { duration: motion.duracao('fast'), easing: motion.entrada });
  }, [indicatorHeight, indicatorLayout, indicatorOpacity, indicatorY, motion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    height: indicatorHeight.value,
    opacity: indicatorOpacity.value,
    transform: [{ translateY: indicatorY.value }],
  }));

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}><BrandMark inverse /></View>
      <ScrollView contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
        <Animated.View pointerEvents="none" style={[styles.activeIndicator, indicatorStyle]} />
        {groups.map((group) => (
          <View
            key={group.title}
            onLayout={(event) => {
              const { y } = event.nativeEvent.layout;
              setGruposY((anterior) => (anterior[group.title] === y ? anterior : { ...anterior, [group.title]: y }));
            }}
            style={styles.navGroup}
          >
            <Text accessibilityRole="header" style={styles.groupLabel}>{group.title}</Text>
            {group.items.map((item) => (
              <SidebarItem
                active={activeItem?.key === item.key}
                item={item}
                key={item.key}
                onLayout={(event) => {
                  const { height, y } = event.nativeEvent.layout;
                  setLayouts((previous) => previous[item.key]?.y === y && previous[item.key]?.height === height
                    ? previous
                    : { ...previous, [item.key]: { height, y } });
                }}
                onPress={() => router.navigate(item.href as never)}
                onPrefetch={() => prefetchDaRota(item.href, role)}
                pendingCount={item.key === 'ferias' && CAN_APPROVE.includes(role ?? '') ? pendentesCount : 0}
                pulsoPendencias={pulsoPendencias}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { backgroundColor: cores.sidebar.superficie, borderRightColor: cores.accent.borda, borderRightWidth: borda.fina, width: espaco.tela * 4 },
  brand: { borderBottomColor: cores.accent.borda, borderBottomWidth: borda.fina, minHeight: tamanho.toqueMinimo + espaco.xxl, justifyContent: 'center', paddingHorizontal: espaco.xl },
  sidebarContent: { paddingBottom: espaco.xxl, paddingHorizontal: espaco.sm, paddingTop: espaco.lg, position: 'relative' },
  activeIndicator: { backgroundColor: cores.sidebar.accent, borderRadius: raio.pill, left: espaco.xs, position: 'absolute', top: espaco.zero, width: tamanho.indicador },
  navGroup: { gap: espaco.xs, marginBottom: espaco.xl },
  groupLabel: { ...tipografia.rotulo, color: cores.sidebar.textoInativo, paddingHorizontal: espaco.md, textTransform: 'uppercase' },
  sidebarItem: { alignItems: 'center', borderColor: cores.superficie.transparente, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, overflow: 'hidden', paddingHorizontal: espaco.md, position: 'relative' },
  sidebarItemActive: { backgroundColor: cores.sidebar.itemAtivo },
  sidebarItemHover: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, backgroundColor: cores.sidebar.hover },
  sidebarItemFocused: { borderColor: cores.foco.anel, borderWidth: borda.foco },
  sidebarLabel: { ...tipografia.corpoForte, color: cores.sidebar.textoInativo, flex: 1 },
  sidebarLabelActive: { color: cores.sidebar.texto },
  sidebarPendingBadge: { alignItems: 'center', backgroundColor: cores.status.erro.forte, borderRadius: raio.pill, height: espaco.lg, justifyContent: 'center', minWidth: espaco.lg, paddingHorizontal: espaco.micro },
  sidebarPendingBadgeText: { ...tipografia.legenda, color: cores.texto.sobreEscuro },
});
