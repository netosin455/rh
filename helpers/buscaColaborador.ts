// ============================================================
// helpers/buscaColaborador.ts — SuperRH
// Busca de colaborador por nome ou cargo, sem diferenciar acentos nem maiúsculas.
// Sem React e sem rede.
// ============================================================

import type { Employee } from '../tipos/modelos';

/** "João" e "joao" viram a mesma coisa. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

type OpcoesBusca = {
  /** Máximo de resultados (lista curta). Padrão: 6. */
  max?: number;
  /** Sem digitar nada: lista os primeiros em vez de nada. Padrão: false. */
  listarSemBusca?: boolean;
  /** Desligados ficam de fora por padrão (não faz sentido lançar nada para quem saiu). */
  incluirDesligados?: boolean;
};

type ColaboradorBuscavel = Pick<Employee, 'id' | 'name' | 'role_title' | 'status'>;

/** Nome OU cargo contém o que foi digitado. Mantém a ordem original da lista. */
export function filtrarColaboradores<T extends ColaboradorBuscavel>(lista: readonly T[], consulta: string, opcoes: OpcoesBusca = {}): T[] {
  const { max = 6, listarSemBusca = false, incluirDesligados = false } = opcoes;
  const q = normalizarTexto(consulta);
  if (!q && !listarSemBusca) return [];
  return lista
    .filter((e) => incluirDesligados || e.status !== 'desligado')
    .filter((e) => !q || normalizarTexto(e.name).includes(q) || normalizarTexto(e.role_title ?? '').includes(q))
    .slice(0, max);
}
