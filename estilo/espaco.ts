import type { ViewStyle } from 'react-native';

/** Escala espacial única para controles, conteúdo e overlays. */
export const espaco = {
  zero: 0,
  micro: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gigante: 40,
  secao: 48,
  tela: 64,
} as const;

/** Raios: 8 para controles, 12 para cartões. */
export const raio = {
  controle: 8,
  cartao: 12,
  overlay: 16,
  pill: 999,
  /** @deprecated Use `controle`. */
  sm: 8,
  /** @deprecated Use `cartao`. */
  md: 12,
  /** @deprecated Use `cartao`. */
  lg: 12,
  /** @deprecated Use `overlay`. */
  xl: 16,
  /** @deprecated Use `pill`. */
  full: 999,
} as const;

export const tamanho = {
  toqueMinimo: 44,
  iconePequeno: 16,
  iconeMedio: 20,
  iconeGrande: 24,
  avatarPequeno: 32,
  avatarMedio: 40,
  avatarGrande: 56,
  indicador: 4,
  barraProgresso: 8,
  regraMarca: 2,
} as const;

export const borda = {
  fina: 1,
  foco: 2,
} as const;

export const largura = {
  completa: '100%',
  leitura: 520,
  drawer: 400,
  sheet: 640,
  textoCurto: 300,
} as const;

export const opacidade = {
  desabilitado: 0.55,
  backdrop: 0.34,
  sutil: 0.72,
} as const;

export const camada = {
  toast: 100,
} as const;

/** Geometria de elevação. A cor da sombra vem de `theme.elevacao`. */
export const elevacao: Record<'nenhuma' | 'overlay', Pick<ViewStyle, 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>> = {
  nenhuma: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  overlay: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 1, shadowRadius: 40, elevation: 8 },
};

/** @deprecated Use `espaco`. Mantido para telas ainda não migradas. */
export const spacing = {
  xs: espaco.xs,
  sm: espaco.sm,
  md: espaco.lg,
  lg: espaco.xxl,
  xl: espaco.xxxl,
} as const;

/** @deprecated Use `raio`. Mantido para telas ainda não migradas. */
export const radius = raio;
