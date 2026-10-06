// ============================================================
// helpers/alertas.ts — SuperRH
// Alertas proativos do Dashboard: ícone, gravidade e rota com fallback seguro.
// Um tipo novo/desconhecido vindo da API nunca pode quebrar a tela. Sem React e sem rede.
// ============================================================

import type { ProactiveAlert } from '../tipos/modelos';

/** Ícone padrão de cada tipo (usado quando a API não manda um ícone que exista). */
export const ICONE_POR_TIPO: Record<string, string> = {
  turnover_risk: 'trending-down-outline',
  absenteeism: 'people-outline',
  juridico: 'briefcase-outline',
  onboarding: 'rocket-outline',
  experiencia_acabando: 'hourglass-outline',
  banco_horas_alto: 'time-outline',
  faltas_recentes: 'alert-circle-outline',
};

export const ICONE_PADRAO_ALERTA = 'alert-circle-outline';

/**
 * Ícone do alerta: o da API se ele existir no conjunto de ícones (`glifos`), senão o do tipo, senão o padrão.
 * `glifos` é o `Ionicons.glyphMap` (passado de fora para este arquivo continuar sem React).
 */
export function iconeDoAlerta(alerta: Pick<ProactiveAlert, 'type' | 'icon'>, glifos: Record<string, unknown>): string {
  if (alerta.icon && alerta.icon in glifos) return alerta.icon;
  const doTipo = ICONE_POR_TIPO[alerta.type];
  return doTipo && doTipo in glifos ? doTipo : ICONE_PADRAO_ALERTA;
}

/** Só "alta" é urgente; "media" e qualquer valor desconhecido viram "importante". */
export function nivelDoAlerta(alerta: Pick<ProactiveAlert, 'severity'>): 'urgent' | 'important' {
  return alerta.severity === 'alta' ? 'urgent' : 'important';
}
