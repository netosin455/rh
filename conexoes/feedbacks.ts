import { apiFetch, ApiError } from './http';
import type { CreateFeedbackData, Feedback, PublicFeedback } from '../tipos/modelos';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const FALLBACK_PUBLIC_APP_URL = 'https://super-rh.vercel.app';

function publicApiUrl(path: string): string {
  if (!API_URL) throw new ApiError(0, 'URL da API não configurada.');
  return `${API_URL}${path}`;
}

export function feedbackPublicUrl(token: string): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL;
  const base = configured || API_URL.replace(/\/api\/?$/, '') || FALLBACK_PUBLIC_APP_URL;
  return `${base.replace(/\/$/, '')}/feedback/${token}`;
}

export function feedbackPdfUrl(token: string): string {
  return publicApiUrl(`/api/feedback/public/${token}/pdf`);
}

export async function getFeedbacks(): Promise<Feedback[]> {
  return apiFetch<Feedback[]>('/api/feedbacks');
}

export async function getFeedback(id: number): Promise<Feedback> {
  return apiFetch<Feedback>(`/api/feedbacks/${id}`);
}

export async function createFeedback(data: CreateFeedbackData): Promise<Feedback> {
  return apiFetch<Feedback>('/api/feedbacks', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateFeedback(id: number, data: CreateFeedbackData): Promise<Feedback> {
  return apiFetch<Feedback>(`/api/feedbacks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function publishFeedback(id: number): Promise<Feedback> {
  return apiFetch<Feedback>(`/api/feedbacks/${id}/publish`, { method: 'POST' });
}

export async function revokeFeedback(id: number): Promise<Feedback> {
  return apiFetch<Feedback>(`/api/feedbacks/${id}/revoke`, { method: 'POST' });
}

async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(publicApiUrl(path), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(response.status, payload?.error ?? `Erro ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getPublicFeedback(token: string): Promise<PublicFeedback> {
  return publicFetch<PublicFeedback>(`/api/feedback/public/${token}`);
}

export async function acknowledgeFeedback(token: string): Promise<{ acknowledged_at: string; already_acknowledged: boolean }> {
  return publicFetch(`/api/feedback/public/${token}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ acknowledged: true }),
  });
}
