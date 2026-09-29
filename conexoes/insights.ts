// ============================================================
// conexoes/insights.ts — Cliente para /api/insights
// ============================================================

import { apiFetch } from './http';
/** Espelha o formato retornado por GET /api/analytics?view=insights. */
export interface Insight {
  title:         string;
  description:   string;
  severity:      'high' | 'medium' | 'low';
  action_route?: string;
}

export interface InsightsResponse {
  insights: Insight[];
  cached:   boolean;
}

export async function buscarInsights(forceRefresh = false): Promise<InsightsResponse> {
  const qs = forceRefresh ? '&refresh=1' : '';
  return apiFetch<InsightsResponse>(`/api/analytics?view=insights${qs}`);
}
