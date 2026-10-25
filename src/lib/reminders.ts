import type { Reminder } from '../types';
import { toDayKey } from './dates';

const WINDOW_MINUTES = 90;

export function minutesFromTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function quietHours(nowMinutes: number, start: string, end: string): boolean {
  const startMinutes = minutesFromTime(start);
  const endMinutes = minutesFromTime(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function dueReminder(
  reminders: Reminder[],
  now: Date,
  quietStart: string,
  quietEnd: string
): Reminder | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (quietHours(nowMinutes, quietStart, quietEnd)) return null;

  for (const reminder of reminders) {
    if (!reminder.enabled) continue;
    const scheduled = minutesFromTime(reminder.time);
    if (scheduled === null) continue;
    const delta = nowMinutes - scheduled;
    if (delta >= 0 && delta <= WINDOW_MINUTES) return reminder;
  }

  return null;
}

export function dismissedReminderKey(date: Date, meal: string): string {
  return `calai:reminder-dismissed:${toDayKey(date)}:${meal}`;
}

export function wasReminderDismissed(reminder: Reminder, now = new Date()): boolean {
  try {
    return (
      localStorage.getItem(dismissedReminderKey(now, reminder.meal)) === '1'
    );
  } catch {
    return false;
  }
}

export function dismissReminder(reminder: Reminder, now = new Date()): void {
  try {
    localStorage.setItem(dismissedReminderKey(now, reminder.meal), '1');
  } catch {
    // Storage is blocked; the banner can reappear on the next load.
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function icsTime(date: Date, time: string): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${time.replace(':', '')}00`;
}

function icsStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildReminderIcs(
  reminders: Reminder[],
  now = new Date(),
  summary = 'Time to log a meal'
): string | null {
  const enabled = reminders.filter((reminder) => reminder.enabled);
  if (enabled.length === 0) return null;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalAI//Meal reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CalAI meal reminders'
  ];

  for (const reminder of enabled) {
    const label = reminder.meal.charAt(0).toUpperCase() + reminder.meal.slice(1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:calai-${reminder.id}-${icsStamp(now)}@calai.local`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsTime(now, reminder.time)}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeIcs(`${summary}: ${label}`)}`,
      `DESCRIPTION:${escapeIcs(
        'Open CalAI and log this meal. CalAI is local-first; this calendar reminder works without an account.'
      )}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`CalAI: ${label}`)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}
