import { apiFetch } from './api';
import { LegalCase, CreateCaseData } from '../types';

export async function getCases(status?: string): Promise<LegalCase[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/api/cases${q}`);
}

export async function getCaseById(id: number): Promise<LegalCase> {
  return apiFetch(`/api/cases/${id}`);
}

export async function createCase(data: CreateCaseData): Promise<LegalCase> {
  return apiFetch('/api/cases', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCase(id: number, data: Partial<CreateCaseData>): Promise<LegalCase> {
  return apiFetch(`/api/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCase(id: number): Promise<void> {
  return apiFetch(`/api/cases/${id}`, { method: 'DELETE' });
}
