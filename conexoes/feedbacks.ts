import { apiFetch, ApiError, publicFetch } from './http';
import { comInvalidacao } from '../helpers/invalidacaoCache';
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
  return comInvalidacao('feedbacks', apiFetch<Feedback>('/api/feedbacks', { method: 'POST', body: JSON.stringify(data) }));
}

export async function updateFeedback(id: number, data: CreateFeedbackData): Promise<Feedback> {
  return comInvalidacao('feedbacks', apiFetch<Feedback>(`/api/feedbacks/${id}`, { method: 'PUT', body: JSON.stringify(data) }));
}

/** Exclui o feedback (qualquer status). A API responde 204. */
export async function deleteFeedback(id: number): Promise<void> {
  return comInvalidacao('feedbacks', apiFetch(`/api/feedbacks/${id}`, { method: 'DELETE' }));
}

export async function publishFeedback(id: number): Promise<Feedback> {
  return comInvalidacao('feedbacks', apiFetch<Feedback>(`/api/feedbacks/${id}/publish`, { method: 'POST' }));
}

export async function revokeFeedback(id: number): Promise<Feedback> {
  return comInvalidacao('feedbacks', apiFetch<Feedback>(`/api/feedbacks/${id}/revoke`, { method: 'POST' }));
}

export async function getPublicFeedback(token: string): Promise<PublicFeedback> {
  return publicFetch<PublicFeedback>(`/api/feedback/public/${token}`);
}

/** Confirma a leitura. A observação é opcional (até 1000 caracteres); em branco não é enviada. */
export async function acknowledgeFeedback(
  token: string,
  note?: string,
): Promise<{ acknowledged_at: string; already_acknowledged: boolean; acknowledgment_note?: string | null }> {
  const observacao = note?.trim();
  return comInvalidacao('feedbacks', publicFetch(`/api/feedback/public/${token}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(observacao ? { acknowledged: true, note: observacao } : { acknowledged: true }),
  }));
}
