import { apiFetch } from './http';
import { Absence, CreateAbsenceData } from '../../tipos/modelos';

export async function getAbsences(
  status?: string,
  page = 1,
  limit = 50,
  type?: string,
  month?: string,
): Promise<Absence[]> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (type)   params.set('type', type);
  if (month)  params.set('month', month);
  const res = await apiFetch(`/api/absences?${params}`);
  return res?.data ?? res;
}

export async function countAbsences(type?: string, month?: string): Promise<number> {
  const params = new URLSearchParams({ page: '1', limit: '1' });
  if (type)  params.set('type', type);
  if (month) params.set('month', month);
  const res = await apiFetch(`/api/absences?${params}`);
  return res?.total ?? 0;
}

export async function countPendentes(): Promise<number> {
  const params = new URLSearchParams({ page: '1', limit: '1', status: 'pendente' });
  const res = await apiFetch(`/api/absences?${params}`);
  return res?.total ?? 0;
}

export async function getPendingAbsences(): Promise<Absence[]> {
  const res = await apiFetch(`/api/absences?status=pendente&limit=50`);
  return res?.data ?? res;
}

export async function createAbsence(data: CreateAbsenceData): Promise<Absence> {
  return apiFetch('/api/absences', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveAbsence(id: number, approved: boolean): Promise<Absence> {
  return apiFetch(`/api/absences/${id}`, { method: 'PATCH', body: JSON.stringify({ approved }) });
}

export async function updateAbsence(id: number, data: Partial<CreateAbsenceData>): Promise<Absence> {
  return apiFetch(`/api/absences/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteAbsence(id: number): Promise<void> {
  return apiFetch(`/api/absences/${id}`, { method: 'DELETE' });
}
