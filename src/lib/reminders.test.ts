import { describe, expect, it } from 'vitest';
import type { Reminder } from '../types';
import { buildReminderIcs, dueReminder, minutesFromTime } from './reminders';

const reminders: Reminder[] = [
  { id: 'lunch', meal: 'lunch', time: '12:30', enabled: true },
  { id: 'dinner', meal: 'dinner', time: '18:30', enabled: true }
];

function at(hour: number, minute: number): Date {
  return new Date(2026, 9, 24, hour, minute, 0);
}

describe('reminders', () => {
  it('parses times and rejects malformed values', () => {
    expect(minutesFromTime('12:30')).toBe(750);
    expect(minutesFromTime('00:00')).toBe(0);
    expect(minutesFromTime('24:00')).toBeNull();
    expect(minutesFromTime('noon')).toBeNull();
  });

  it('returns a reminder inside its window and respects quiet hours', () => {
    expect(dueReminder(reminders, at(12, 45), '21:00', '07:00')?.id).toBe('lunch');
    expect(dueReminder(reminders, at(13, 30), '21:00', '07:00')?.id).toBe('lunch');
    expect(dueReminder(reminders, at(10, 0), '21:00', '07:00')).toBeNull();
    expect(dueReminder(reminders, at(12, 45), '12:00', '13:00')).toBeNull();
  });

  it('handles quiet hours that wrap past midnight', () => {
    expect(dueReminder(reminders, at(23, 0), '21:00', '07:00')).toBeNull();
    expect(dueReminder(reminders, at(6, 0), '21:00', '07:00')).toBeNull();
  });

  it('builds a daily .ics file with alarms', () => {
    const ics = buildReminderIcs(reminders, new Date(2026, 9, 24, 9, 0, 0));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261024T123000');
    expect(ics).toContain('DTSTART:20261024T183000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('returns null when no reminder is enabled', () => {
    expect(
      buildReminderIcs(reminders.map((item) => ({ ...item, enabled: false })))
    ).toBeNull();
  });
});
