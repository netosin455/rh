// ============================================================
// helpers/filtros.ts — SuperRH
// Filtros que moram na URL (query params) para Equipe e Férias: "todo número leva a um lugar".
// Valor ausente ou inválido => sem filtro. Sem React e sem rede.
// ============================================================

import type { AbsenceType } from '../tipos/modelos';

// ── Equipe: /colaboradores?status=ativo ─────────────────────

/** `licenca_afastado` junta Licença + Afastado (é o que o card "Em licença" do Analytics conta). */
export type FiltroEquipe = 'todos' | 'ativo' | 'ferias' | 'licenca' | 'afastado' | 'licenca_afastado' | 'desligado';

const FILTROS_EQUIPE: readonly FiltroEquipe[] = ['ativo', 'ferias', 'licenca', 'afastado', 'licenca_afastado', 'desligado'];

/** Rótulo do chip dos filtros que não ficam fixos na barra (só aparecem enquanto ativos). */
export const ROTULO_FILTRO_TEMPORARIO: Partial<Record<FiltroEquipe, string>> = { licenca_afastado: 'Licença e afastados', desligado: 'Desligados' };

export function lerFiltroEquipe(valor: string | string[] | undefined): FiltroEquipe {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return FILTROS_EQUIPE.find((f) => f === bruto) ?? 'todos';
}

/** Licença cobre as variantes (médica, maternidade, paternidade); "licenca_afastado" soma Afastado. */
export function combinaComFiltroEquipe(status: string, filtro: FiltroEquipe): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'licenca') return status.startsWith('licenca');
  if (filtro === 'licenca_afastado') return status.startsWith('licenca') || status === 'afastado';
  return status === filtro;
}

export function rotaEquipe(filtro: FiltroEquipe = 'todos'): string {
  return filtro === 'todos' ? '/colaboradores' : `/colaboradores?status=${filtro}`;
}

// ── Férias: /ferias?tab=falta ───────────────────────────────

export type AbaFerias = AbsenceType | 'todos';

const ABAS_FERIAS: readonly AbsenceType[] = ['falta', 'ferias', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'folga', 'outro'];

export function lerAbaFerias(valor: string | string[] | undefined): AbaFerias {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return ABAS_FERIAS.find((a) => a === bruto) ?? 'todos';
}

export function rotaFerias(aba: AbaFerias = 'todos'): string {
  return aba === 'todos' ? '/ferias' : `/ferias?tab=${aba}`;
}
