// ============================================================
// services/employees.ts
// ============================================================
import { apiFetch } from './api';
import { Employee, CreateEmployeeData, UpdateEmployeeData } from '../types';

export async function getEmployees(): Promise<Employee[]> {
  return apiFetch('/api/employees');
}

export async function getEmployeeById(id: number): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`);
}

export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  return apiFetch('/api/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployee(id: number, data: UpdateEmployeeData): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEmployee(id: number): Promise<void> {
  return apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
}

// ============================================================
// services/cases.ts
// ============================================================
import { apiFetch as fetch2 } from './api';
import { LegalCase, CreateCaseData } from '../types';

export async function getCases(status?: string): Promise<LegalCase[]> {
  const q = status ? `?status=${status}` : '';
  return fetch2(`/api/cases${q}`);
}

export async function getCaseById(id: number): Promise<LegalCase> {
  return fetch2(`/api/cases/${id}`);
}

export async function createCase(data: CreateCaseData): Promise<LegalCase> {
  return fetch2('/api/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCase(id: number, data: Partial<CreateCaseData>): Promise<LegalCase> {
  return fetch2(`/api/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCase(id: number): Promise<void> {
  return fetch2(`/api/cases/${id}`, { method: 'DELETE' });
}

// ============================================================
// services/events.ts
// ============================================================
import { apiFetch as fetch3 } from './api';
import { Event, CreateEventData } from '../types';

export async function getEventsByMonth(month: string): Promise<Event[]> {
  return fetch3(`/api/events?month=${month}`);
}

export async function getEventsByDate(date: string): Promise<Event[]> {
  return fetch3(`/api/events?date=${date}`);
}

export async function getUpcomingEvents(limit = 10): Promise<Event[]> {
  return fetch3(`/api/events?upcoming=true&limit=${limit}`);
}

export async function createEvent(data: CreateEventData): Promise<Event> {
  return fetch3('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<Event> {
  return fetch3(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  return fetch3(`/api/events/${id}`, { method: 'DELETE' });
}

// ============================================================
// services/absences.ts
// ============================================================
import { apiFetch as fetch4 } from './api';
import { Absence, CreateAbsenceData } from '../types';

export async function getAbsences(status?: string): Promise<Absence[]> {
  const q = status ? `?status=${status}` : '';
  return fetch4(`/api/absences${q}`);
}

export async function createAbsence(data: CreateAbsenceData): Promise<Absence> {
  return fetch4('/api/absences', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveAbsence(id: number, approved: boolean): Promise<Absence> {
  return fetch4(`/api/absences/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ approved }),
  });
}

export async function deleteAbsence(id: number): Promise<void> {
  return fetch4(`/api/absences/${id}`, { method: 'DELETE' });
}
