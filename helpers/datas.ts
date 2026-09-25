export function ymd(s: string): string {
  return s ? s.slice(0, 10) : '';
}

/** Valida uma data civil ISO sem permitir normalização silenciosa (ex.: 31/02). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/** Diferença inclusiva entre datas civis, imune ao horário de verão local. */
export function calendarDaysInclusive(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  return (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000 + 1;
}

export function brToIso(br: string): string {
  const p = br.replace(/\D/g, '');
  if (p.length !== 8) return '';
  return `${p.slice(4, 8)}-${p.slice(2, 4)}-${p.slice(0, 2)}`;
}

export function isoToBr(iso: string): string {
  const [y, m, d] = ymd(iso).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
}

export function maskDate(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function todayBr(): string {
  return isoToBr(getTodayString());
}

export function getTodayString(): string {
  return toDateString(new Date());
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = ymd(dateStr).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const [y, m, d] = ymd(dateStr).split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = ymd(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' });
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayString();
}

export function daysBetween(start: string, end: string): number {
  return calendarDaysInclusive(start, end);
}

export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

