// ============================================================
// helpers/aquecerCache.ts — SuperRH
// Aquecimento do cache depois do login (fluidez F3): com a sessão válida, busca em SEGUNDO PLANO os dados
// principais das telas mais usadas para que a 1ª visita de cada tela já abra com conteúdo (a API real leva
// 0,45 a 1 s por chamada). Regras:
//  - só o que o PERFIL pode abrir (mesmas permissões do menu, helpers/shellNav.ts): nada de /api que daria 403;
//  - no máximo 3 pedidos em paralelo (fila simples), começando pela tela atual e pelo Dashboard;
//  - dado já fresco ou pedido já em andamento não é refeito (deduplicação do cacheDados);
//  - erro é silencioso (nunca toast) e não interrompe a fila;
//  - cancela no logout, em 401 e na troca de usuário (o cache é limpo e `aoLimpar` cancela a fila).
// SÓ LEITURA: nunca use com escrita.
// ============================================================

import { aoLimpar, buscarComCache, estaFresco } from './cacheDados';
import { TarefaDePrefetch, tarefasDaRota } from './prefetchRotas';
import { SHELL_GROUPS, canAccessNavigation } from './shellNav';

export const LIMITE_PARALELO = 3;

/** Telas aquecidas, na ordem de prioridade (depois da tela atual e do Dashboard). */
const ROTAS_DO_AQUECIMENTO = [
  '/(tabs)',
  '/(tabs)/colaboradores',
  '/(tabs)/ferias',
  '/(tabs)/avisos',
  '/(tabs)/agenda',
  '/notificacoes',
  '/pesquisas',
  '/feedbacks',
  '/(tabs)/analytics',
] as const;

const TODOS_OS_ITENS = SHELL_GROUPS.flatMap((g) => g.items);

/** Pathname do navegador ("/", "/colaboradores", "/feedbacks/novo") → href do menu ("/(tabs)", "/(tabs)/colaboradores"...). */
export function hrefDoPathname(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return '/(tabs)';
  const item = TODOS_OS_ITENS.find((i) => i.href.replace('/(tabs)', '') === pathname);
  if (item) return item.href;
  if (pathname === '/notificacoes') return '/notificacoes';
  return null;
}

/** A rota existe no menu e o perfil pode abri-la? Rotas fora do menu (ex.: notificações) valem para todos. */
export function perfilPodeAbrir(href: string, papel: string | undefined): boolean {
  const item = TODOS_OS_ITENS.find((i) => i.href === href);
  return item ? canAccessNavigation(item.roles, papel) : true;
}

/** Tarefas na ordem de prioridade, sem repetir chave e só com o que o perfil acessa. */
export function tarefasParaAquecer(papel: string | undefined, pathname: string): TarefaDePrefetch[] {
  const atual = hrefDoPathname(pathname);
  const hrefs = [...(atual ? [atual] : []), ...ROTAS_DO_AQUECIMENTO];
  const vistas = new Set<string>();
  const tarefas: TarefaDePrefetch[] = [];
  for (const href of hrefs) {
    if (!perfilPodeAbrir(href, papel)) continue;
    for (const t of tarefasDaRota(href, papel)) {
      if (vistas.has(t.chave)) continue;
      vistas.add(t.chave);
      tarefas.push(t);
    }
  }
  return tarefas;
}

export interface FilaDeAquecimento {
  cancelar: () => void;
  /** Resolve quando a fila termina (ou é cancelada). Nunca rejeita. */
  concluida: Promise<void>;
}

/** Busca uma tarefa e grava no cache. Dado fresco: não faz nada. Erro: silencioso. */
export async function executarTarefa(t: TarefaDePrefetch): Promise<void> {
  if (estaFresco(t.chave)) return;
  try {
    await buscarComCache(t.chave, t.buscar);
  } catch {
    /* aquecimento falho: a tela busca de novo quando abrir */
  }
}

/** Fila com no máximo `limite` tarefas em andamento ao mesmo tempo; mantém a ordem; `cancelar` impede novos inícios. */
export function executarFila(
  tarefas: readonly TarefaDePrefetch[],
  limite: number = LIMITE_PARALELO,
  executar: (t: TarefaDePrefetch) => Promise<void> = executarTarefa,
): FilaDeAquecimento {
  let proxima = 0;
  let cancelada = false;

  async function trabalhador(): Promise<void> {
    while (!cancelada && proxima < tarefas.length) {
      const tarefa = tarefas[proxima];
      proxima += 1;
      try { await executar(tarefa); } catch { /* uma tarefa falha nunca derruba a fila */ }
    }
  }

  const trabalhadores = Math.max(1, Math.min(limite, tarefas.length));
  const concluida = Promise.all(Array.from({ length: trabalhadores }, () => trabalhador())).then(() => undefined);
  return { cancelar: () => { cancelada = true; }, concluida };
}

/** Dispara o aquecimento. A fila também é cancelada quando o cache da sessão é limpo (logout, 401, troca de usuário). */
export function aquecerCache(papel: string | undefined, pathname: string): FilaDeAquecimento {
  const fila = executarFila(tarefasParaAquecer(papel, pathname));
  const soltar = aoLimpar(fila.cancelar);
  void fila.concluida.then(soltar);
  return { cancelar: () => { fila.cancelar(); soltar(); }, concluida: fila.concluida };
}
