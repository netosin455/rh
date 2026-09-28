/** Famílias carregadas em `app/_layout.tsx`. Inter é a fonte da interface. */
export const familias = {
  corpo: 'Inter_400Regular',
  medio: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  negrito: 'Inter_700Bold',
  marca: 'CormorantGaramond_600SemiBold',
} as const;

/** Escala tipográfica semântica. Cormorant fica restrita à marca. */
export const tipografia = {
  display: { fontFamily: familias.negrito, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  titulo: { fontFamily: familias.negrito, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
  subtitulo: { fontFamily: familias.semibold, fontSize: 18, lineHeight: 26 },
  corpo: { fontFamily: familias.corpo, fontSize: 14, lineHeight: 20 },
  corpoForte: { fontFamily: familias.semibold, fontSize: 14, lineHeight: 20 },
  legenda: { fontFamily: familias.medio, fontSize: 12, lineHeight: 16 },
  rotulo: { fontFamily: familias.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  marca: { fontFamily: familias.marca, fontSize: 28, lineHeight: 32, letterSpacing: 0.2 },
} as const;

/** @deprecated Use `familias` ou a escala `tipografia`. */
export const fonts = {
  body: familias.corpo,
  medium: familias.medio,
  semibold: familias.semibold,
  bold: familias.negrito,
  display: familias.negrito,
  brand: familias.marca,
} as const;
