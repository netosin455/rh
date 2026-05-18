// ============================================================
// conexoes/insights.ts — Cliente para /api/insights
// ============================================================

import { apiFetch } from './http';
import type { Insight } from '../api/insights';

export type { Insight };

export interface InsightsResponse {
  insights: Insight[];
  cached:   boolean;
}

export async function buscarInsights(forceRefresh = false): Promise<InsightsResponse> {
  const qs = forceRefresh ? '&refresh=1' : '';
  return apiFetch<InsightsResponse>(`/api/analytics?view=insights${qs}`);
}
