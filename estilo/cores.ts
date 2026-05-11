// ============================================================
// TEMA SUPERRH — Escritório de Advocacia
// Paleta: Preto Profundo + Dourado + Branco
// ============================================================

export const theme = {
  // ── Fundos ──────────────────────────────────────────────
  bg:           '#141210',   // carvão quente (fundo das telas)
  surface:      '#1C1916',   // superfície principal (cards, sidebar)
  surface2:     '#242018',   // superfície elevada (modais, hover)
  surface3:     '#2C261E',   // superfície mais elevada

  // ── Dourado ─────────────────────────────────────────────
  gold:         '#D4AF50',   // dourado principal (ligeiramente mais brilhante)
  goldLight:    '#EDD98A',   // dourado claro (texto sobre escuro)
  goldDim:      'rgba(212,175,80,0.18)', // dourado translúcido (fundo de badges)
  goldGlow:     'rgba(212,175,80,0.12)', // brilho suave

  // ── Bordas ──────────────────────────────────────────────
  border:       'rgba(212,175,80,0.22)', // borda padrão (dourado visível)
  border2:      'rgba(212,175,80,0.42)', // borda enfatizada
  borderWhite:  'rgba(255,255,255,0.10)', // borda neutra

  // ── Textos ──────────────────────────────────────────────
  white:        '#FFFFFF',
  text:         '#FFFFFF',   // texto principal — branco puro
  textMuted:    '#9A9890',   // texto secundário (ligeiramente mais claro)
  textLight:    '#C8C5BC',   // texto intermediário

  // ── Status ──────────────────────────────────────────────
  success:      '#2EBD7C',
  warning:      '#F59E0B',
  danger:       '#E05252',
  info:         '#4A8FD4',

  // ── Categorias jurídicas ─────────────────────────────────
  category: {
    civel:       '#C9A84C', // dourado
    trabalhista: '#4A8FD4', // azul
    tributario:  '#E05252', // vermelho
    familia:     '#9B72CF', // roxo
    criminal:    '#E8955A', // laranja
    empresarial: '#2EBD7C', // verde
    outro:       '#8A887F', // cinza
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
