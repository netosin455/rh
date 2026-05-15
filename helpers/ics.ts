// helpers/ics.ts — gera arquivo iCalendar (.ics) para importar no Google Calendar
import { Platform } from 'react-native';
import type { Event } from '../tipos/modelos';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toICSDate(dateStr: string, timeStr?: string): string {
  // Usa tempo local (sem Z) para evitar conversão de fuso incorreta
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi]    = (timeStr ?? '00:00').split(':').map(Number);
  return `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`;
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

    // Calcula fim: usa end_time, ou start_time+1h, ou evento de dia inteiro
    let end: string;
    if (e.end_time) {
      end = toICSDate(e.date, e.end_time);
    } else if (e.start_time) {
      const [h, m] = e.start_time.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endDate = endH === 0 ? addDay(e.date) : e.date;
      end = toICSDate(endDate, `${pad(endH)}:${pad(m)}`);
    } else {
      end = toICSDate(addDay(e.date));
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:superrh-${e.id}@superrh`);
    if (e.is_all_day) {
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${addDay(e.date).replace(/-/g, '')}`);
    } else {
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    if (e.location)    lines.push(`LOCATION:${escapeICS(e.location)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events: Event[], filename = 'agenda-superrh.ics') {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const content = buildICS(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Aguarda o browser iniciar o download antes de revogar a URL
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 2000);
}
