// ============================================================
// helpers/navegacao.ts — SuperRH
// Fonte única de verdade para o item ativo da sidebar: o pathname.
// ============================================================

/** Campos mínimos de um item de navegação para resolver o ativo. */
export interface ItemNavegavel {
  key: string;
  /** Destino do item, ex.: '/(tabs)/colaboradores' ou '/onboarding'. */
  href: string;
  /** Prefixos extras que pertencem ao item, ex.: '/colaborador' (detalhe do colaborador). */
  subrotas?: readonly string[];
}

/** Remove query/hash, grupos do Expo Router `(tabs)` e barra final. '/(tabs)' vira '/'. */
export function normalizarCaminho(caminho: string): string {
  const semQuery = caminho.split(/[?#]/)[0] ?? '';
  const segmentos = semQuery
    .split('/')
    .filter((segmento) => segmento !== '' && !/^\(.*\)$/.test(segmento));
  return `/${segmentos.join('/')}`;
}

/** True se `caminho` é `prefixo` ou está abaixo dele (respeitando fronteira de segmento). */
function estaSob(caminho: string, prefixo: string): boolean {
  if (prefixo === '/') return caminho === '/';
  return caminho === prefixo || caminho.startsWith(`${prefixo}/`);
}

/**
 * Retorna a chave do item que corresponde ao pathname, ou undefined se nenhum.
 * Vence o prefixo mais específico (mais longo), então '/colaborador/12',
 * '/onboarding/3' e '/pesquisas/7' marcam o item pai certo.
 */
export function resolverItemAtivo(
  pathname: string,
  itens: readonly ItemNavegavel[],
): string | undefined {
  const alvo = normalizarCaminho(pathname);
  let melhor: { key: string; tamanho: number } | undefined;

  for (const item of itens) {
    const prefixos = [item.href, ...(item.subrotas ?? [])].map(normalizarCaminho);
    for (const prefixo of prefixos) {
      if (!estaSob(alvo, prefixo)) continue;
      if (!melhor || prefixo.length > melhor.tamanho) {
        melhor = { key: item.key, tamanho: prefixo.length };
      }
    }
  }
  return melhor?.key;
}

/** Rotas sem shell: login, link público de feedback e resposta de pesquisa. */
const ROTAS_SEM_SHELL: readonly string[] = ['/login', '/feedback', '/responder'];

/**
 * Indica se a sidebar do shell deve aparecer para o pathname.
 * (Quem chama ainda precisa checar se há usuário logado e se a web é larga.)
 * '/feedbacks' (área do RH) mostra o shell; '/feedback/[token]' (público) não.
 */
export function deveMostrarShell(pathname: string): boolean {
  const alvo = normalizarCaminho(pathname);
  return !ROTAS_SEM_SHELL.some((rota) => estaSob(alvo, rota));
}
