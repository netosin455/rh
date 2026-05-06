import { apiFetch } from './http';
import { Absence, CreateAbsenceData } from '../../tipos/modelos';

export async function getAbsences(status?: string): Promise<Absence[]> {
  const q = status ? `?status=${status}` : '';
  return apiFetch(`/api/absences${q}`);
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
