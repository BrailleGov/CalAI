import { describe, expect, it } from 'vitest';
import {
  addDays,
  fromDayKey,
  isFutureDay,
  isValidDayKey,
  lastNDayKeys,
  relativeDayLabel,
  toDayKey
} from './dates';

describe('day keys', () => {
  it('creates and parses local day keys', () => {
    const date = new Date(2026, 9, 24, 23, 30);
    const key = toDayKey(date);
    expect(key).toBe('2026-10-24');
    expect(toDayKey(fromDayKey(key) as Date)).toBe(key);
  });

  it('rejects impossible dates and malformed strings', () => {
    expect(isValidDayKey('2026-02-29')).toBe(false);
    expect(isValidDayKey('2024-02-29')).toBe(true);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('24-10-2026')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('builds ordered day windows', () => {
    expect(lastNDayKeys(3, '2026-10-24')).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24'
    ]);
  });

  it('compares future days against today', () => {
    expect(isFutureDay('2026-10-25', '2026-10-24')).toBe(true);
    expect(isFutureDay('2026-10-24', '2026-10-24')).toBe(false);
    expect(isFutureDay('2026-10-23', '2026-10-24')).toBe(false);
  });

  it('labels today and yesterday', () => {
    expect(relativeDayLabel('2026-10-24', '2026-10-24')).toBe('Today');
    expect(relativeDayLabel('2026-10-23', '2026-10-24')).toBe('Yesterday');
    expect(relativeDayLabel('2026-10-20', '2026-10-24')).toBeNull();
  });
});
