import { apiFetch } from './http';
import { LegalCase, CreateCaseData, UpdateCaseData } from '../tipos/modelos';

export async function getCases(params?: {
  status?: string;
  area?: string;
  search?: string;
}): Promise<LegalCase[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.area)   qs.set('area',   params.area);
  if (params?.search) qs.set('search', params.search);
  const q = qs.toString();
  return apiFetch(`/api/cases${q ? `?${q}` : ''}`);
}

export async function getCaseById(id: number): Promise<LegalCase> {
  return apiFetch(`/api/cases/${id}`);
}

export async function createCase(data: CreateCaseData): Promise<LegalCase> {
  return apiFetch('/api/cases', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCase(id: number, data: UpdateCaseData): Promise<LegalCase> {
  return apiFetch(`/api/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCase(id: number): Promise<void> {
  return apiFetch(`/api/cases/${id}`, { method: 'DELETE' });
}
