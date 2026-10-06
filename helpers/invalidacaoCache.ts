// ============================================================
// helpers/invalidacaoCache.ts — SuperRH
// Qual dado em cache fica velho quando algo é ESCRITO. A invalidação é feita DENTRO das funções de
// escrita de conexoes/*.ts (nenhuma tela precisa lembrar). Na dúvida, invalida MAIS (nunca menos).
// Sem React e sem rede.
// ============================================================

import { invalidar } from './cacheDados';

/** O que uma escrita mexe. */
export type RecursoEscrito =
  | 'absences'
  | 'employees'
  | 'events'
  | 'notices'
  | 'surveys'
  | 'feedbacks'
  | 'recognitions'
  | 'notifications'
  | 'onboarding'
  | 'users'
  | 'payslips';

/**
 * Prefixos de cache afetados por cada escrita.
 *  - Lançamento/aprovação/exclusão de ausência mexe no SALDO de folga e férias (employees), nos números
 *    do Analytics/Dashboard (analytics, que também traz os alertas) e no fechamento do mês.
 *  - Mexer em colaborador muda lista de ausências (nome/cargo vêm junto), analytics e fechamento.
 */
export const PREFIXOS_AFETADOS: Record<RecursoEscrito, readonly string[]> = {
  absences: ['absences', 'employees', 'analytics', 'fechamento', 'notifications'],
  employees: ['employees', 'absences', 'analytics', 'fechamento', 'onboarding', 'feedbacks', 'recognitions'],
  events: ['events', 'notifications'],
  notices: ['notices', 'notifications'],
  surveys: ['surveys', 'analytics', 'notifications'],
  feedbacks: ['feedbacks', 'notifications'],
  recognitions: ['recognitions', 'notifications'],
  notifications: ['notifications'],
  onboarding: ['onboarding', 'employees', 'analytics', 'notifications'],
  users: ['users'],
  payslips: ['payslips'],
};

export function invalidarEscrita(recurso: RecursoEscrito): void {
  PREFIXOS_AFETADOS[recurso].forEach((prefixo) => invalidar(prefixo));
}

/**
 * Executa a escrita e invalida o que ela afeta. Invalida também quando a escrita FALHA: um timeout ("a ação
 * pode ter sido concluída") deixa o estado do servidor incerto, então o dado em cache não vale mais.
 */
export async function comInvalidacao<T>(recurso: RecursoEscrito, escrita: Promise<T>): Promise<T> {
  try {
    return await escrita;
  } finally {
    invalidarEscrita(recurso);
  }
}
