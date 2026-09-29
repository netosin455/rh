import { apiFetch, extrairLista, RespostaLista } from './http';
import { Notice, CreateNoticeData } from '../tipos/modelos';

export async function getNotices(page = 1, limit = 50): Promise<Notice[]> {
  const res = await apiFetch<RespostaLista<Notice>>(`/api/notices?page=${page}&limit=${limit}`);
  return extrairLista(res);
}

export async function createNotice(data: CreateNoticeData): Promise<Notice> {
  return apiFetch('/api/notices', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateNotice(id: number, data: Partial<CreateNoticeData>): Promise<Notice> {
  return apiFetch(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function pinNotice(id: number, pinned: boolean): Promise<Notice> {
  return apiFetch(`/api/notices/${id}`, { method: 'PATCH', body: JSON.stringify({ pinned }) });
}

export async function deleteNotice(id: number): Promise<void> {
  return apiFetch(`/api/notices/${id}`, { method: 'DELETE' });
}
