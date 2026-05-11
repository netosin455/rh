// ============================================================
// TEMA SUPERRH — Modern Law
// Paleta: Grafite Profundo + Champagne Gold + Off-White
// ============================================================

export const theme = {
  // ── Fundos ──────────────────────────────────────────────
  bg:           '#0F1115',   // grafite profundo
  surface:      '#181B21',   // card glassmorphism base
  surface2:     '#1F2229',   // superfície elevada (modais)
  surface3:     '#272B34',   // superfície mais elevada

  // ── Champagne Gold — metal precioso, uso esparso ─────────
  gold:         '#D4AF37',   // champagne gold
  goldLight:    '#E8CB6A',   // gold claro para texto
  goldDim:      'rgba(212,175,55,0.12)', // toque sutil de gold
  goldGlow:     'rgba(212,175,55,0.07)', // brilho quase imperceptível

  // ── Bordas glass ────────────────────────────────────────
  border:       'rgba(255,255,255,0.07)', // borda glass neutra
  border2:      'rgba(212,175,55,0.28)',  // borda gold enfatizada
  borderWhite:  'rgba(255,255,255,0.10)', // borda branca

  // ── Textos ──────────────────────────────────────────────
  white:        '#FFFFFF',
  text:         '#E5E7EB',   // off-white principal
  textMuted:    '#6B7280',   // cinza médio
  textLight:    '#9CA3AF',   // cinza claro

  // ── Status ──────────────────────────────────────────────
  success:      '#34D399',
  warning:      '#FBBF24',
  danger:       '#F87171',
  info:         '#60A5FA',

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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;
