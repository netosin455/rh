import { apiFetch } from './http';

export interface Notificacao {
  id:         number;
  title:      string;
  body:       string | null;
  type:       string | null;
  route:      string | null;
  read:       boolean;
  created_at: string;
}

export interface NotificacoesResponse {
  notifications: Notificacao[];
  unread:        number;
}

export function buscarNotificacoes(): Promise<NotificacoesResponse> {
  return apiFetch<NotificacoesResponse>('/api/users?notifications=1');
}

export function marcarLida(id: number): Promise<{ ok: boolean }> {
  return apiFetch('/api/users?notifications=1', {
    method: 'PATCH',
    body:   JSON.stringify({ id }),
  });
}

export function marcarTodasLidas(): Promise<{ ok: boolean }> {
  return apiFetch('/api/users?notifications=1', {
    method: 'PATCH',
    body:   JSON.stringify({ all: true }),
  });
}
