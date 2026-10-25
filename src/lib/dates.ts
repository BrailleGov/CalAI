import { APP_LOCALE } from './locale';

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function fromDayKey(key: string): Date | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function isValidDayKey(key: string): boolean {
  return fromDayKey(key) !== null;
}

export function addDays(key: string, delta: number): string {
  const date = fromDayKey(key);
  if (!date) return key;

  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

export function isFutureDay(key: string, today = todayKey()): boolean {
  return isValidDayKey(key) && key > today;
}

export function relativeDayLabel(key: string, today = todayKey()): string | null {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key === addDays(today, 1)) return 'Tomorrow';
  return null;
}

export function formatDayLong(key: string): string {
  const date = fromDayKey(key);
  if (!date) return key;

  return new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatDayMedium(key: string): string {
  const date = fromDayKey(key);
  if (!date) return key;

  return new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function formatWeekday(key: string): string {
  const date = fromDayKey(key);
  if (!date) return key;

  return new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short' }).format(date);
}

export function formatWeekdayNarrow(key: string): string {
  const date = fromDayKey(key);
  if (!date) return key;

  return new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'narrow' }).format(date);
}

export function lastNDayKeys(count: number, end = todayKey()): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(addDays(end, -offset));
  }
  return keys;
}
