// ============================================================
// TEMA SUPERRH — Escritório de Advocacia
// Paleta: Preto Profundo + Dourado + Branco
// ============================================================

export const theme = {
  // ── Fundos ──────────────────────────────────────────────
  bg:           '#09090B',   // preto profundo (fundo das telas)
  surface:      '#111114',   // superfície principal (cards, sidebar)
  surface2:     '#18181C',   // superfície elevada (modais, hover)
  surface3:     '#1F1F24',   // superfície mais elevada

  // ── Dourado ─────────────────────────────────────────────
  gold:         '#C9A84C',   // dourado principal
  goldLight:    '#E2C97E',   // dourado claro (texto sobre escuro)
  goldDim:      'rgba(201,168,76,0.14)', // dourado translúcido (fundo de badges)
  goldGlow:     'rgba(201,168,76,0.08)', // brilho suave

  // ── Bordas ──────────────────────────────────────────────
  border:       'rgba(201,168,76,0.10)', // borda padrão (suave dourado)
  border2:      'rgba(201,168,76,0.20)', // borda enfatizada
  borderWhite:  'rgba(255,255,255,0.06)', // borda neutra

  // ── Textos ──────────────────────────────────────────────
  white:        '#FFFFFF',
  text:         '#F2F0EA',   // texto principal (off-white quente)
  textMuted:    '#8A887F',   // texto secundário
  textLight:    '#B8B5AA',   // texto intermediário

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
