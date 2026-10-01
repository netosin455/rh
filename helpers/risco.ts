// ============================================================
// helpers/risco.ts — SuperRH
// Risco de saída (turnover): classificação, motivos legíveis e filtro na URL.
// Sem React e sem rede.
//
// ATENÇÃO: os limiares abaixo ESPELHAM a regra do banco (banco/migrations/006_analytics_engagement.sql),
// que é quem decide o nível devolvido por GET /api/analytics. Se a regra mudar lá, mude aqui
// (e nos testes), senão o motivo mostrado na tela deixa de bater com o nível.
//   ALTO  = faltas_90d >= 4  OU  dias_na_empresa < 90  OU  pulso < 2,5
//   MÉDIO = faltas_90d >= 2  OU  pulso < 3,5
//   BAIXO = o resto
// Pulso ausente (null) não conta como sinal.
// ============================================================

import type { EmployeeAtRisk, ProactiveAlert } from '../tipos/modelos';

export type NivelRisco = 'alto' | 'medio' | 'baixo';

export const NIVEIS_RISCO: readonly NivelRisco[] = ['alto', 'medio', 'baixo'];

export const ROTULO_RISCO: Record<NivelRisco, string> = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };

/** ≥ 4 faltas nos últimos 90 dias => alto. */
export const LIMIAR_FALTAS_ALTO = 4;
/** < 90 dias de empresa => alto. */
export const LIMIAR_DIAS_EMPRESA_ALTO = 90;
/** pulso médio < 2,5 => alto. */
export const LIMIAR_PULSO_ALTO = 2.5;
/** ≥ 2 faltas nos últimos 90 dias => médio. */
export const LIMIAR_FALTAS_MEDIO = 2;
/** pulso médio < 3,5 => médio. */
export const LIMIAR_PULSO_MEDIO = 3.5;

/** O pulso pode chegar como número, texto numérico (numeric do Postgres) ou null. */
function lerPulso(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

type DadosRisco = Pick<EmployeeAtRisk, 'days_in_company' | 'absences_90d'> & { avg_pulse_score?: number | string | null };

/** Mesma regra do banco (ver cabeçalho). */
export function classificarRisco(e: DadosRisco): NivelRisco {
  const pulso = lerPulso(e.avg_pulse_score);
  if (e.absences_90d >= LIMIAR_FALTAS_ALTO || e.days_in_company < LIMIAR_DIAS_EMPRESA_ALTO || (pulso !== null && pulso < LIMIAR_PULSO_ALTO)) return 'alto';
  if (e.absences_90d >= LIMIAR_FALTAS_MEDIO || (pulso !== null && pulso < LIMIAR_PULSO_MEDIO)) return 'medio';
  return 'baixo';
}

/**
 * Pulso com 1 casa decimal, mas com 2 quando arredondar esconderia o motivo
 * (2,49 mostrado como "2,5" pareceria não estar abaixo de 2,5).
 */
export function formatarPulso(pulso: number): string {
  const umaCasa = pulso.toFixed(1);
  const enganoso = (pulso < LIMIAR_PULSO_ALTO && Number(umaCasa) >= LIMIAR_PULSO_ALTO) || (pulso < LIMIAR_PULSO_MEDIO && Number(umaCasa) >= LIMIAR_PULSO_MEDIO);
  return (enganoso ? pulso.toFixed(2) : umaCasa).replace('.', ',');
}

function textoFaltas(n: number): string {
  return `${n} ${n === 1 ? 'falta' : 'faltas'} em 90 dias`;
}

function textoDiasEmpresa(dias: number): string {
  if (dias <= 0) return 'Entrou hoje';
  return `Há ${dias} ${dias === 1 ? 'dia' : 'dias'} na empresa`;
}

/**
 * Todos os motivos que se aplicam (alto e médio listam tudo, não só o que decidiu o nível).
 * Baixo: "Sem sinais de atenção".
 */
export function motivosDeRisco(e: DadosRisco): string[] {
  const motivos: string[] = [];
  if (e.absences_90d >= LIMIAR_FALTAS_MEDIO) motivos.push(textoFaltas(e.absences_90d));
  if (e.days_in_company < LIMIAR_DIAS_EMPRESA_ALTO) motivos.push(textoDiasEmpresa(e.days_in_company));
  const pulso = lerPulso(e.avg_pulse_score);
  if (pulso !== null && pulso < LIMIAR_PULSO_MEDIO) motivos.push(`Pulso ${formatarPulso(pulso)}/5`);
  return motivos.length > 0 ? motivos : ['Sem sinais de atenção'];
}

// ── Filtro na URL (/analytics?risco=medio) ──────────────────

/** Lê o parâmetro `risco` da URL. Valor ausente ou inválido => null (sem filtro). */
export function lerFiltroRisco(valor: string | string[] | undefined): NivelRisco | null {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return NIVEIS_RISCO.find((n) => n === bruto) ?? null;
}

/** Rota da tela de Analytics, já filtrada quando houver nível. */
export function rotaAnalytics(risco?: NivelRisco): string {
  return risco ? `/analytics?risco=${risco}` : '/analytics';
}

/** "Risco médio · 5 pessoas" */
export function tituloDaLista(nivel: NivelRisco, quantidade: number): string {
  return `Risco ${ROTULO_RISCO[nivel].toLowerCase()} · ${quantidade} ${quantidade === 1 ? 'pessoa' : 'pessoas'}`;
}

/**
 * Para onde um alerta do Dashboard leva. O alerta de risco de saída vai direto para a lista
 * filtrada; os demais seguem a rota que a API informou. (Usa o `type`, não o texto do título.)
 */
export function rotaDoAlerta(alerta: Pick<ProactiveAlert, 'type' | 'route'>): string {
  if (alerta.type === 'turnover_risk') return rotaAnalytics('alto');
  return `/${alerta.route}`;
}

/**
 * Motivos para exibir ao lado do nível que o SERVIDOR devolveu. Se a regra local não achar
 * motivo para alto/médio (dados defasados, regra mudou no banco), avisa em vez de dizer
 * "sem sinais" sobre alguém que a API colocou em risco.
 */
export function motivosParaNivel(e: DadosRisco, nivelDoServidor: NivelRisco): string[] {
  const motivos = motivosDeRisco(e);
  if (nivelDoServidor !== 'baixo' && motivos.length === 1 && motivos[0] === 'Sem sinais de atenção') {
    return ['Nível definido pelo servidor (motivo não aparece nestes dados)'];
  }
  return motivos;
}
