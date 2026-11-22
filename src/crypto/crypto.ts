// Task 4: value encryption. PBKDF2-SHA256 -> AES-256-GCM, random 12-byte IV per value.
// Never log the password, the key, or decrypted values.

export const DEFAULT_ITERATIONS = 600_000;
export const VERIFIER_TEXT = 'Kiroween2026';
const IV_BYTES = 12;
const SALT_BYTES = 16;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Derive a non-extractable AES-GCM key from the password. */
export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Returns base64(iv || ciphertext+tag). */
export async function encryptValue(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toBase64(out);
}

/** Throws if the key is wrong or the value was changed. */
export async function decryptValue(key: CryptoKey, b64: string): Promise<string> {
  const bytes = fromBase64(b64);
  if (bytes.length <= IV_BYTES) throw new Error('Encrypted value is too short');
  const iv = bytes.slice(0, IV_BYTES);
  const ct = bytes.slice(IV_BYTES);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}
