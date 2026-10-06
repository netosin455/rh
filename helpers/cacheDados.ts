// ============================================================
// helpers/cacheDados.ts — SuperRH
// Cache pequeno em memória, com revalidação (stale-while-revalidate). Sem React e sem dependência.
//
// Regras que NÃO podem ser quebradas:
//  - o cache é da SESSÃO: limpar() no logout, em 401 e ao trocar de usuário (computador compartilhado, LGPD);
//  - escrita invalida: nenhum pedido que estava em andamento ANTES da invalidação pode gravar dado velho;
//  - pedidos iguais em andamento são um só (deduplicação).
// ============================================================

/** Quanto tempo um dado é considerado fresco. Depois disso a tela mostra o dado e atualiza em segundo plano. */
export const TTL_PADRAO_MS = 60_000;

export interface EntradaCache<T> {
  dados: T;
  atualizadoEm: number;
}

/** Pedido em andamento. `obsoleto` vira true se uma invalidação/limpeza passou por cima: o resultado não é gravado. */
interface Pedido {
  promessa: Promise<unknown>;
  obsoleto: boolean;
}

const entradas = new Map<string, EntradaCache<unknown>>();
const pedidos = new Map<string, Pedido>();
const ultimoPrefetch = new Map<string, number>();
const ouvintes = new Set<() => void>();
const ouvintesDeInvalidacao = new Set<{ prefixo: string; chamar: () => void }>();
let versao = 0;

function avisar(): void {
  versao += 1;
  ouvintes.forEach((fn) => fn());
}

/** "employees" casa com "employees" e "employees:todos", mas não com "employeesX". */
export function chaveCasaComPrefixo(chave: string, prefixo: string): boolean {
  return chave === prefixo || chave.startsWith(`${prefixo}:`);
}

export function lerCache<T>(chave: string): EntradaCache<T> | undefined {
  return entradas.get(chave) as EntradaCache<T> | undefined;
}

export function gravarCache<T>(chave: string, dados: T, agora: number = Date.now()): void {
  entradas.set(chave, { dados, atualizadoEm: agora });
  avisar();
}

/** Altera o dado em cache (ex.: tirar um item da lista na hora). Sem entrada, não faz nada. Mantém `atualizadoEm`. */
export function atualizarCache<T>(chave: string, transformar: (atual: T) => T): void {
  const atual = entradas.get(chave);
  if (!atual) return;
  entradas.set(chave, { dados: transformar(atual.dados as T), atualizadoEm: atual.atualizadoEm });
  avisar();
}

/** Idade do dado em ms, ou null se não há cache. */
export function idadeDoCache(chave: string, agora: number = Date.now()): number | null {
  const e = entradas.get(chave);
  return e ? agora - e.atualizadoEm : null;
}

export function estaFresco(chave: string, ttlMs: number = TTL_PADRAO_MS, agora: number = Date.now()): boolean {
  const idade = idadeDoCache(chave, agora);
  return idade !== null && idade < ttlMs;
}

export function temPedidoEmAndamento(chave: string): boolean {
  return pedidos.has(chave);
}

/**
 * Busca com cache: pedido igual em andamento é reaproveitado; ao terminar, grava o resultado
 * (a menos que uma invalidação/limpeza tenha passado por cima enquanto o pedido voava).
 * Erro não grava nada e é repassado.
 */
export function buscarComCache<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const existente = pedidos.get(chave);
  if (existente) return existente.promessa as Promise<T>;

  const pedido: Pedido = { promessa: Promise.resolve(), obsoleto: false };
  pedido.promessa = (async () => {
    try {
      const dados = await buscar();
      if (!pedido.obsoleto) gravarCache(chave, dados);
      return dados;
    } finally {
      // Só remove se ainda for este pedido (uma invalidação pode ter aberto outro com a mesma chave).
      if (pedidos.get(chave) === pedido) pedidos.delete(chave);
    }
  })();
  pedidos.set(chave, pedido);
  return pedido.promessa as Promise<T>;
}

/** Quem pediu o resultado de um pedido obsoleto não deve usá-lo: este teste diz se foi invalidado depois de iniciar. */
export function pedidoObsoleto(chave: string): boolean {
  return pedidos.get(chave)?.obsoleto ?? false;
}

/**
 * Invalida tudo que começa com o prefixo (com fronteira ":"): remove o dado e marca os pedidos
 * em andamento como obsoletos. Quem está com a tela aberta é avisado e busca de novo.
 */
export function invalidar(prefixo: string): void {
  for (const chave of [...entradas.keys()]) if (chaveCasaComPrefixo(chave, prefixo)) entradas.delete(chave);
  for (const [chave, pedido] of [...pedidos.entries()]) {
    if (chaveCasaComPrefixo(chave, prefixo)) { pedido.obsoleto = true; pedidos.delete(chave); }
  }
  for (const chave of [...ultimoPrefetch.keys()]) if (chaveCasaComPrefixo(chave, prefixo)) ultimoPrefetch.delete(chave);
  avisar();
  ouvintesDeInvalidacao.forEach((o) => { if (chaveCasaComPrefixo(o.prefixo, prefixo) || chaveCasaComPrefixo(prefixo, o.prefixo)) o.chamar(); });
}

/** Esquece TUDO (logout, 401, troca de usuário). Pedidos em andamento não gravam mais nada. */
export function limpar(): void {
  entradas.clear();
  pedidos.forEach((p) => { p.obsoleto = true; });
  pedidos.clear();
  ultimoPrefetch.clear();
  avisar();
}

/** Para o hook reagir a mudanças. Devolve a função de cancelar. */
export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

/** Número que muda a cada alteração do cache (useSyncExternalStore). */
export function versaoDoCache(): number {
  return versao;
}

/** Roda `chamar` quando algo sob `prefixo` for invalidado (ex.: o contador de pendências do menu). */
export function aoInvalidar(prefixo: string, chamar: () => void): () => void {
  const registro = { prefixo, chamar };
  ouvintesDeInvalidacao.add(registro);
  return () => { ouvintesDeInvalidacao.delete(registro); };
}

/**
 * Pré-carrega (web, ao passar o mouse/focar). Só se não há dado fresco nem pedido em andamento, e no
 * máximo uma vez por TTL por chave. Erros são engolidos: prefetch nunca incomoda. NUNCA use com escrita.
 */
export function prefetch<T>(chave: string, buscar: () => Promise<T>, ttlMs: number = TTL_PADRAO_MS, agora: number = Date.now()): void {
  if (estaFresco(chave, ttlMs, agora) || temPedidoEmAndamento(chave)) return;
  const ultimo = ultimoPrefetch.get(chave);
  if (ultimo !== undefined && agora - ultimo < ttlMs) return;
  ultimoPrefetch.set(chave, agora);
  buscarComCache(chave, buscar).catch(() => { /* prefetch falho: a tela busca de novo quando abrir */ });
}

/** Dado fresco do cache, ou busca (com deduplicação). Para ações que precisam do dado agora (ex.: abrir um modal). */
export async function obterDados<T>(chave: string, buscar: () => Promise<T>, ttlMs: number = TTL_PADRAO_MS): Promise<T> {
  const entrada = lerCache<T>(chave);
  if (entrada && estaFresco(chave, ttlMs)) return entrada.dados;
  return buscarComCache(chave, buscar);
}
