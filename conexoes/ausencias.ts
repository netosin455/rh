import { apiFetch } from './http';
import { Absence, CreateAbsenceData } from '../../tipos/modelos';

export async function getAbsences(status?: string, page = 1, limit = 50): Promise<Absence[]> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  const res = await apiFetch(`/api/absences?${params}`);
  return res?.data ?? res;
}

export async function createAbsence(data: CreateAbsenceData): Promise<Absence> {
  return apiFetch('/api/absences', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveAbsence(id: number, approved: boolean): Promise<Absence> {
  return apiFetch(`/api/absences/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ approved }) });
}

export async function deleteAbsence(id: number): Promise<void> {
  return apiFetch(`/api/absences/${id}`, { method: 'DELETE' });
}
