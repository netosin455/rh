// ============================================================
// estilo/dial.ts — SuperRH
// O "dial" de intensidade do movimento: UM lugar para subir ou descer o quanto o app se mexe (fluidez F3).
// Puro (sem React/Reanimated) para poder ser testado no Vitest; estilo/movimento.ts reexporta.
// Intensidade atual: MÉDIA (a F2 foi SUTIL: 8 px / 200 ms / 30 ms / tela 6 px). Teto duro: entrada de
// conteúdo nunca passa de 250 ms nem de 12 px (tests/dial.test.ts garante).
// ============================================================

export type IntensidadeMovimento = 'sutil' | 'media';

/** Troque aqui para mudar a intensidade do app inteiro. */
export const INTENSIDADE_ATUAL: IntensidadeMovimento = 'media';

const perfis = {
  sutil: { itemMs: 200, itemPx: 8, intervaloMs: 30, telaMs: 180, telaPx: 6 },
  media: { itemMs: 240, itemPx: 12, intervaloMs: 40, telaMs: 220, telaPx: 10 },
} as const;

const perfil = perfis[INTENSIDADE_ATUAL];

export const dial = {
  /** Entrada de cada item de lista (nunca acima de 250 ms) e deslocamento vertical (nunca acima de 12 px). */
  itemMs: perfil.itemMs,
  itemPx: perfil.itemPx,
  /** Intervalo do escalonamento (máx. 8 itens animados). */
  intervaloMs: perfil.intervaloMs,
  /** Transição de tela na 1ª visita (fade + deslocamento). A revisita é só um fade de 120 ms. */
  telaMs: perfil.telaMs,
  telaPx: perfil.telaPx,
  revisitaMs: 120,
  /** Realce ao passar o mouse em Card/ListRow clicáveis: sobe 1 px em 140 ms. */
  hoverMs: 140,
  hoverElevacaoPx: 1,
  /** Números e barras (F3): contagem 400–600 ms, barras 400–500 ms, escalonamento de barras ≤ 60 ms. */
  contagemMs: 500,
  barraMs: 450,
  /** Troca suave de cor (ex.: faixa do NPS). */
  corMs: 300,
  intervaloBarrasMs: 50,
  /** Curva "ease-out" um pouco mais marcada que a cúbica: bezier de saída suave (quint). */
  curvaMarcada: [0.22, 1, 0.36, 1] as const,
} as const;
