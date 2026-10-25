import { describe, expect, it } from 'vitest';
import { maskPhone, normalizePhone, smsPreview, validatePhone } from './sms';

describe('sms helpers', () => {
  it('normalizes common phone formats', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('555 123 4567')).toBe('5551234567');
  });

  it('requires a country-code-length number', () => {
    expect(validatePhone('1234567')).not.toBeNull();
    expect(validatePhone('+15551234567')).toBeNull();
  });

  it('masks saved numbers for display', () => {
    expect(maskPhone('+15551234567')).toBe('•••• 4567');
  });

  it('states that replies are not monitored', () => {
    expect(smsPreview('lunch')).toContain('Replies are not monitored');
  });
});
