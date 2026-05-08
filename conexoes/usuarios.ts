import { apiFetch } from './http';

export interface SystemUser {
  id: number;
  company_id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

export async function getUsers(): Promise<SystemUser[]> {
  return apiFetch('/api/users');
}

export async function createUser(data: CreateUserData): Promise<SystemUser> {
  return apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateUser(id: number, data: UpdateUserData): Promise<SystemUser> {
  return apiFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteUser(id: number): Promise<void> {
  return apiFetch(`/api/users/${id}`, { method: 'DELETE' });
}
