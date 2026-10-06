// ============================================================
// helpers/chavesCache.ts — SuperRH
// Chaves previsíveis do cache, por recurso e filtro. O PRIMEIRO trecho (antes do ":") é o prefixo que
// helpers/invalidacaoCache.ts invalida. Telas e pré-carregamento usam as mesmas chaves daqui.
// ============================================================

export const chaves = {
  colaboradores: 'employees:todos',
  ausencias: 'absences:todos',
  ausenciasPendentes: 'absences:status=pendente',
  contagemPendentes: 'absences:contagem:pendente',
  contagemFaltas: (mes: string) => `absences:contagem:falta:${mes}`,
  eventosDoMes: (mes: string) => `events:${mes}`,
  proximosEventos: (limite: number) => `events:proximos:${limite}`,
  avisos: 'notices',
  alertas: 'analytics:alertas',
  analytics: 'analytics:geral',
  /** Resumos de IA: não invalidam a cada escrita (são caros e o servidor já guarda cópia). */
  insights: 'insights:ia',
  fechamento: (mes: string) => `fechamento:${mes}`,
  pesquisas: (audience: 'employees' | 'customers') => `surveys:${audience}`,
  feedbacks: 'feedbacks',
  notificacoes: 'notifications:lista',
  reconhecimentos: 'recognitions',
} as const;
