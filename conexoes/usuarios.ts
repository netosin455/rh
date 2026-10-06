import { apiFetch, extrairLista, RespostaLista } from './http';
import { comInvalidacao } from '../helpers/invalidacaoCache';

export interface SystemUser {
  id: number;
  company_id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

export async function getUsers(page = 1, limit = 50): Promise<SystemUser[]> {
  const res = await apiFetch<RespostaLista<SystemUser>>(`/api/users?page=${page}&limit=${limit}`);
  return extrairLista(res);
}

export async function createUser(data: CreateUserData): Promise<SystemUser> {
  return comInvalidacao('users', apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }));
}

export async function updateUser(id: number, data: UpdateUserData): Promise<SystemUser> {
  return comInvalidacao('users', apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }));
}

export async function deleteUser(id: number): Promise<void> {
  return comInvalidacao('users', apiFetch(`/api/users/${id}`, { method: 'DELETE' }));
}
