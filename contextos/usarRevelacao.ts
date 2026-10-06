// ============================================================
// contextos/usarRevelacao.ts — SuperRH
// Decide COMO os itens de uma lista entram (fluidez F2). A regra de ouro: conteúdo que já estava em cache
// NUNCA é atrasado. Só anima quando a lista veio de um esqueleto.
//   'escalonado' : a lista acabou de sair do esqueleto (1ª carga ou cache vazio): entrada escalonada.
//   'nenhum'     : abriu já com cache (ou revalidação): tudo aparece no 1º frame, sem animação.
//   'rapido'     : item que aparece DEPOIS de a lista já estar na tela (volta do rollback, item novo): fade curto.
// ============================================================

import { useEffect, useRef, useState } from 'react';

export type ModoEntrada = 'escalonado' | 'nenhum' | 'rapido';

/**
 * `carregando`: a tela está mostrando o esqueleto. `temConteudo`: já há dado para mostrar (evita contar como
 * "lista na tela" o momento em que a tela ainda nem buscou, ex.: sessão sendo restaurada).
 */
export function usarRevelacao(carregando: boolean, temConteudo = true): ModoEntrada {
  const viuEsqueleto = useRef(false);
  const [revelado, setRevelado] = useState(false);
  if (carregando) viuEsqueleto.current = true;

  // Depois do 1º commit com conteúdo, a lista "já está na tela": itens que chegarem depois entram no modo rápido.
  useEffect(() => {
    if (!carregando && temConteudo) setRevelado(true);
  }, [carregando, temConteudo]);

  if (revelado) return 'rapido';
  return viuEsqueleto.current ? 'escalonado' : 'nenhum';
}
