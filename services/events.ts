import { apiFetch } from './api';
import { Event, CreateEventData } from '../types';

export async function getEventsByMonth(month: string): Promise<Event[]> {
  return apiFetch(`/api/events?month=${month}`);
}

export async function getEventsByDate(date: string): Promise<Event[]> {
  return apiFetch(`/api/events?date=${date}`);
}

export async function getUpcomingEvents(limit = 10): Promise<Event[]> {
  return apiFetch(`/api/events?upcoming=true&limit=${limit}`);
}

export async function createEvent(data: CreateEventData): Promise<Event> {
  return apiFetch('/api/events', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<Event> {
  return apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEvent(id: string): Promise<void> {
  return apiFetch(`/api/events/${id}`, { method: 'DELETE' });
}
