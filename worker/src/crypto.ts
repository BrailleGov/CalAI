export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function base64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyBase64);
  if (raw.byteLength !== 32) {
    throw new Error('DATA_ENC_KEY must be a base64-encoded 32-byte key');
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ]);
}

export async function encryptJson(
  value: unknown,
  keyBase64: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(keyBase64);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv)
  };
}

export async function encryptText(
  value: string,
  keyBase64: string
): Promise<{ ciphertext: string; iv: string }> {
  return encryptJson({ value }, keyBase64);
}

export async function decryptJson<T>(
  ciphertext: string,
  iv: string,
  keyBase64: string
): Promise<T> {
  const key = await importKey(keyBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export async function decryptText(
  ciphertext: string,
  iv: string,
  keyBase64: string
): Promise<string> {
  const value = await decryptJson<{ value?: unknown }>(ciphertext, iv, keyBase64);
  return typeof value.value === 'string' ? value.value : '';
}
