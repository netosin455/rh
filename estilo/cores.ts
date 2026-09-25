// ============================================================
// TEMA SUPERRH — Modern Law
// Paleta: Grafite Profundo + Champagne Gold + Off-White
// ============================================================

export const theme = {
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
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Border radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 12,
  xl: 20,
  full: 999,
} as const;
