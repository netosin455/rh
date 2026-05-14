import { apiFetch } from './http';
import { PulseSurvey, SurveyResults, CreateSurveyData } from '../../tipos/modelos';

export async function getSurveys(): Promise<PulseSurvey[]> {
  return apiFetch<PulseSurvey[]>('/api/surveys');
}

export async function getSurvey(id: number): Promise<PulseSurvey> {
  return apiFetch<PulseSurvey>(`/api/surveys/${id}`);
}

export async function getSurveyResults(id: number): Promise<SurveyResults> {
  return apiFetch<SurveyResults>(`/api/surveys/${id}/results`);
}

export async function createSurvey(data: CreateSurveyData): Promise<PulseSurvey> {
  return apiFetch<PulseSurvey>('/api/surveys', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteSurvey(id: number): Promise<void> {
  return apiFetch(`/api/surveys/${id}`, { method: 'DELETE' });
}

// Responder — chamado pela página pública, sem token
export async function respondSurvey(id: number, payload: { score?: number; choice?: string }): Promise<void> {
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const res = await fetch(`${API_URL}/api/surveys/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Erro ${res.status}`);
  }
}
