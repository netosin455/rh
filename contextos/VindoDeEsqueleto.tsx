// ============================================================
// contextos/VindoDeEsqueleto.tsx — SuperRH
// Diz aos números e barras (fluidez F3) se o conteúdo acabou de sair de um esqueleto. A regra de ouro:
// só animam (contagem a partir de 0, barra crescendo do zero) quando vieram do esqueleto; com dado em
// cache (revisita) aparecem prontos, no 1º frame. Revelar fornece o valor sozinho; telas sem Revelar
// usam useVindoDeEsqueleto(carregando) + o Provider.
// ============================================================

import { createContext, useRef } from 'react';

export const VindoDeEsqueletoContexto = createContext(false);

/** true a partir do momento em que a tela mostrou um esqueleto pelo menos uma vez. */
export function useVindoDeEsqueleto(carregando: boolean): boolean {
  const viu = useRef(false);
  if (carregando) viu.current = true;
  return viu.current;
}
