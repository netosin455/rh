// helpers/ics.ts — gera arquivo iCalendar (.ics) para importar no Google Calendar
import { Platform } from 'react-native';
import type { Event } from '../tipos/modelos';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toICSDate(dateStr: string, timeStr?: string): string {
  const d = new Date(`${dateStr}T${timeStr ?? '00:00'}:00`);
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    'T',
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    '00Z',
  ].join('');
}

function escapeICS(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildICS(events: Event[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SuperRH//Agenda//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const e of events) {
    const start = toICSDate(e.date, e.start_time ?? undefined);
    const end   = e.end_time
      ? toICSDate(e.date, e.end_time)
      : toICSDate(e.date, e.start_time ? String(Number((e.start_time ?? '09:00').split(':')[0]) + 1).padStart(2, '0') + ':00' : '01:00');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:superrh-${e.id}@superrh`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    if (e.location)    lines.push(`LOCATION:${escapeICS(e.location)}`);
    lines.push(`CREATED:${toICSDate(e.created_at.slice(0, 10))}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: Event[], filename = 'agenda-superrh.ics') {
  if (Platform.OS !== 'web') {
    console.warn('exportICS: disponível apenas na versão web');
    return;
  }
  const content = buildICS(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
