import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
  decryptJson,
  encryptJson,
  randomToken,
  sha256Hex
} from './crypto';

const KEY = bytesToBase64(new Uint8Array(32).fill(7));
const OTHER_KEY = bytesToBase64(new Uint8Array(32).fill(9));

describe('worker crypto', () => {
  it('round-trips a JSON snapshot with AES-GCM', async () => {
    const encrypted = await encryptJson(
      { entries: 3, note: 'hello', items: [1, 2, 3] },
      KEY
    );
    expect(encrypted.ciphertext).not.toContain('hello');
    await expect(decryptJson(encrypted.ciphertext, encrypted.iv, KEY)).resolves.toEqual({
      entries: 3,
      note: 'hello',
      items: [1, 2, 3]
    });
  });

  it('fails with a different key', async () => {
    const encrypted = await encryptJson({ secret: true }, KEY);
    await expect(
      decryptJson(encrypted.ciphertext, encrypted.iv, OTHER_KEY)
    ).rejects.toBeTruthy();
  });

  it('encodes base64 and hashes deterministically', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
    expect(await sha256Hex('calai')).toBe(await sha256Hex('calai'));
    expect(await sha256Hex('calai')).not.toBe(await sha256Hex('calai2'));
  });

  it('generates unguessable tokens and compares them safely', () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(constantTimeEqual(first, first)).toBe(true);
    expect(constantTimeEqual(first, second)).toBe(false);
  });
});
