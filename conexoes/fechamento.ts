import { apiFetch } from './http';
import { normalizarFechamento } from '../helpers/fechamento';
import type { Fechamento } from '../tipos/modelos';

/** Fechamento do mês (AAAA-MM). Mês inválido => 400 da API. Saldo do banco é o ATUAL. */
export async function getFechamento(mes: string): Promise<Fechamento> {
  return normalizarFechamento(await apiFetch<Fechamento>(`/api/analytics?view=fechamento&month=${encodeURIComponent(mes)}`));
}
