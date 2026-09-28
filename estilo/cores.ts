export const cores = {
  superficie: {
    pagina: '#F4F0EA',
    elevada: '#FFFFFF',
    sutil: '#FBF9F5',
    destaque: '#F5EDD6',
    transparente: 'transparent',
  },
  texto: {
    primario: '#1A1A1A',
    secundario: '#4D4D4D',
    discreto: '#706A60',
    sobreAccent: '#1A1A1A',
    sobreEscuro: '#FFFFFF',
    accentSobreClaro: '#7A6220',
  },
  borda: {
    sutil: '#E7E1D6',
    forte: '#D8D0C0',
  },
  accent: {
    dourado: '#B8973A',
    douradoClaro: '#D4AF5A',
    douradoProfundo: '#7A6220',
    superficie: '#F5EDD6',
    borda: 'rgba(184,151,58,0.30)',
    sutil: 'rgba(184,151,58,0.12)',
  },
  status: {
    sucesso: { forte: '#3D7A5E', superficie: '#E6F0EA', borda: '#B9D5C5' },
    erro: { forte: '#A53A2F', superficie: '#F9ECE9', borda: '#E7BBB5' },
    informacao: { forte: '#2A5581', superficie: '#E9F0F8', borda: '#BBD0E6' },
    pendente: { forte: '#7A6220', superficie: '#F5EDD6', borda: '#DEC98E' },
  },
  sidebar: {
    superficie: '#252525',
    texto: '#FFFFFF',
    textoInativo: 'rgba(255,255,255,0.72)',
    accent: '#D4AF5A',
  },
  foco: {
    anel: '#7A6220',
    superficie: '#F5EDD6',
  },
  elevacao: {
    sombra: 'rgba(26,22,15,0.14)',
    backdrop: 'rgba(26,22,15,0.34)',
  },
  categoria: {
    civel: '#D4AF37',
    trabalhista: '#60A5FA',
    tributario: '#F87171',
    familia: '#A78BFA',
    criminal: '#FB923C',
    empresarial: '#34D399',
    outro: '#6B7280',
  },
  ausencia: {
    maternidade: '#6F4A9A',
    paternidade: '#19714F',
  },
} as const;

// ============================================================
// TEMA SUPERRH — Modern Law
// Paleta: Grafite Profundo + Champagne Gold + Off-White
// ============================================================

/** @deprecated Use `cores` nos novos componentes; mantido para telas ainda não migradas. */
export const theme = {
  superficie: cores.superficie,
  texto: cores.texto,
  bordaSemantica: cores.borda,
  accent: cores.accent,
  status: cores.status,
  sidebarSemantica: cores.sidebar,
  foco: cores.foco,
  elevacao: cores.elevacao,

  /** @deprecated Os aliases abaixo existem apenas para telas ainda não migradas. */
  // Tokens semânticos para o tema claro. Prefira estes em componentes novos.
  card: '#FFFFFF',
  borderStrong: '#D8D0C0',
  textPrimary: '#1A1A1A',
  textSecondary: '#4D4D4D',
  goldPale: '#F5EDD6',
  onGold: '#1A1A1A',
  successBackground: '#E6F0EA',
  dangerBackground: '#F9ECE9',
  onDark: '#FFFFFF',
  warningBackground: '#F5EDD6',
  infoBackground: '#E9F0F8',
  sidebar: '#1A1A1A',
  tabSidebarInactive: 'rgba(255,255,255,0.72)',
  tabSidebarActive: '#D4AF5A',
  tabMobileInactive: '#706A60',
  shadow: 'rgba(26,22,15,0.10)',
  shadowStrong: 'rgba(26,22,15,0.14)',

  // ── Fundos ──────────────────────────────────────────────
  bg:           '#F4F0EA',
  surface:      '#FFFFFF',
  surface2:     '#FFFFFF',
  surface3:     '#F8F1DE',

  // ── Champagne Gold — metal precioso, uso esparso ─────────
  gold:         '#B8973A',
  goldLight:    '#D4AF5A',
  goldDeep:     '#7A6220',
  goldDim:      'rgba(184,151,58,0.12)',
  goldGlow:     'rgba(184,151,58,0.07)',
  goldOutline:  'rgba(184,151,58,0.30)',
  dangerSubtle: 'rgba(224,82,82,0.08)',
  dangerBorder: 'rgba(224,82,82,0.20)',
  dangerOutline: 'rgba(224,82,82,0.40)',
  pendingBackground: 'rgba(201,168,76,0.06)',
  pendingBorder: 'rgba(201,168,76,0.20)',
  pendingCard: 'rgba(24,27,33,0.95)',

  // ── Bordas glass ────────────────────────────────────────
  border:       '#E7E1D6',
  border2:      '#D8D0C0',
  borderWhite:  '#E7E1D6',

  // ── Textos ──────────────────────────────────────────────
  white:        '#1A1A1A',
  text:         '#1A1A1A',
  textMuted:    '#706A60',
  textLight:    '#4D4D4D',

  // ── Status ──────────────────────────────────────────────
  success:      '#3D7A5E',
  warning:      '#B8973A',
  danger:       '#A53A2F',
  info:         '#2A5581',
  absenceMaternity: '#6F4A9A',
  absencePaternity: '#19714F',

  // ── Categorias jurídicas ─────────────────────────────────
  category: {
    civel:       '#D4AF37', // champagne gold
    trabalhista: '#60A5FA', // azul
    tributario:  '#F87171', // vermelho
    familia:     '#A78BFA', // roxo
    criminal:    '#FB923C', // laranja
    empresarial: '#34D399', // verde
    outro:       '#6B7280', // cinza
  },
} as const;

// Constantes de espaçamento
/** @deprecated Use `spacing` de `estilo/espaco`. */
export { spacing } from './espaco';

// Border radius
/** @deprecated Use `radius` de `estilo/espaco`. */
export { radius } from './espaco';
