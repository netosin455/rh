import { apiFetch } from './http';
import { AnalyticsOverview, ProactiveAlert } from '../../tipos/modelos';

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>('/api/analytics');
}

export async function getAlerts(): Promise<ProactiveAlert[]> {
  const data = await apiFetch<AnalyticsOverview>('/api/analytics');
  return data.alerts ?? [];
}
