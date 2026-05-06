import { apiFetch } from './api';

export interface Notice {
  id: number;
  title: string;
  body: string;
  priority: 'normal' | 'importante' | 'urgente';
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  author_name: string;
}

export function getNotices() {
  return apiFetch<Notice[]>('/api/notices');
}

export function createNotice(data: Pick<Notice, 'title' | 'body'> & Partial<Pick<Notice, 'priority' | 'pinned' | 'expires_at'>>) {
  return apiFetch<Notice>('/api/notices', { method: 'POST', body: JSON.stringify(data) });
}

export function deleteNotice(id: number) {
  return apiFetch<void>(`/api/notices/${id}`, { method: 'DELETE' });
}
