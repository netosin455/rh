// ============================================================
// helpers/prefetchRotas.ts — SuperRH
// Pré-carregamento (web): ao passar o mouse ou focar um item do menu, busca o dado principal da tela de
// destino para ela abrir já com conteúdo. SÓ LEITURA, nunca escrita. As chaves são as mesmas das telas
// (helpers/chavesCache.ts), então a tela encontra o dado em cache. No máximo 1 busca por destino por TTL.
// ============================================================

import { getAnalyticsOverview, getAlerts } from '../conexoes/analytics';
import { countAbsences, countPendentes, getAbsences, getPendingAbsences } from '../conexoes/ausencias';
import { getNotices } from '../conexoes/avisos';
import { getEmployees } from '../conexoes/colaboradores';
import { getEventsByMonth, getUpcomingEvents } from '../conexoes/eventos';
import { getFeedbacks } from '../conexoes/feedbacks';
import { getFechamento } from '../conexoes/fechamento';
import { getSurveys } from '../conexoes/pesquisas';
import { getRecognitions } from '../conexoes/reconhecimentos';
import { prefetch } from './cacheDados';
import { chaves } from './chavesCache';
import { getTodayString } from './datas';
import { CAN_APPROVE } from './shellNav';

export interface TarefaDePrefetch {
  chave: string;
  buscar: () => Promise<unknown>;
}

/** Dados principais de cada destino do menu (as mesmas chaves e buscas das telas). */
export function tarefasDaRota(href: string, papel?: string): TarefaDePrefetch[] {
  const mes = getTodayString().slice(0, 7);
  const podeAprovar = CAN_APPROVE.includes(papel ?? '');
  switch (href) {
    case '/(tabs)':
      return [
        { chave: chaves.colaboradores, buscar: () => getEmployees() },
        { chave: chaves.proximosEventos(5), buscar: () => getUpcomingEvents(5) },
        { chave: chaves.avisos, buscar: () => getNotices() },
        { chave: chaves.alertas, buscar: () => getAlerts() },
        { chave: chaves.contagemFaltas(mes), buscar: () => countAbsences('falta', mes) },
        ...(podeAprovar ? [{ chave: chaves.contagemPendentes, buscar: () => countPendentes() }] : []),
      ];
    case '/(tabs)/colaboradores':
      return [{ chave: chaves.colaboradores, buscar: () => getEmployees() }];
    case '/(tabs)/ferias':
      return [
        { chave: chaves.ausencias, buscar: () => getAbsences() },
        { chave: chaves.colaboradores, buscar: () => getEmployees() },
        ...(podeAprovar ? [{ chave: chaves.ausenciasPendentes, buscar: () => getPendingAbsences() }] : []),
      ];
    case '/(tabs)/agenda':
      return [
        { chave: chaves.eventosDoMes(mes), buscar: () => getEventsByMonth(mes) },
        { chave: chaves.colaboradores, buscar: () => getEmployees() },
      ];
    case '/(tabs)/avisos':
      return [{ chave: chaves.avisos, buscar: () => getNotices() }];
    case '/(tabs)/reconhecimentos':
      return [{ chave: chaves.reconhecimentos, buscar: () => getRecognitions() }];
    case '/(tabs)/analytics':
      return [{ chave: chaves.analytics, buscar: () => getAnalyticsOverview() }];
    case '/fechamento':
      return [{ chave: chaves.fechamento(mes), buscar: () => getFechamento(mes) }];
    case '/pesquisas':
      return [{ chave: chaves.pesquisas('employees'), buscar: async () => (await getSurveys('employees')).filter((s) => (s.audience ?? 'employees') === 'employees') }];
    case '/nps':
      return [{ chave: chaves.pesquisas('customers'), buscar: async () => (await getSurveys('customers')).filter((s) => (s.audience ?? 'employees') === 'customers') }];
    case '/feedbacks':
      return [{ chave: chaves.feedbacks, buscar: () => getFeedbacks() }];
    default:
      return [];
  }
}

/** Dispara o pré-carregamento do destino (web, hover/foco). Erros são silenciosos. */
export function prefetchDaRota(href: string, papel?: string): void {
  tarefasDaRota(href, papel).forEach((t) => prefetch(t.chave, t.buscar));
}
