import { apiFetch } from './http';
import { AnalyticsOverview } from '../../tipos/modelos';

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiFetch<AnalyticsOverview>('/api/analytics');
}
