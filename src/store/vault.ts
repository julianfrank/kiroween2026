import {
  DEFAULT_ITERATIONS,
  VERIFIER_TEXT,
  decryptValue,
  deriveKey,
  encryptValue,
  fromBase64,
  randomSalt,
  toBase64,
} from '../crypto/crypto';
import { passwordProblem } from '../crypto/password';
import type { KV } from './kv';

// Fixed, readable keys (ADR-0001). Everything else is an opaque ID and its value is encrypted.
export const META_SALT = 'meta:salt';
export const META_VERIFIER = 'meta:verifier';
export const META_VERSION = 'meta:version';
export const META_ITERATIONS = 'meta:iterations';
// Version 2: amounts are whole rupees and dates are IST (version 1 used paise in test builds).
export const STORE_VERSION = '2';

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password');
    this.name = 'WrongPasswordError';
  }
}

/** An unlocked store. Holds the derived key in memory only. */
export class Vault {
  constructor(
    private readonly kv: KV,
    private readonly key: CryptoKey,
  ) {}

  async putJson(key: string, value: unknown): Promise<void> {
    this.assertDataKey(key);
    await this.kv.put(key, await encryptValue(this.key, JSON.stringify(value)));
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    this.assertDataKey(key);
    const raw = await this.kv.get(key);
    return raw === undefined ? undefined : (JSON.parse(await decryptValue(this.key, raw)) as T);
  }

  /** Plain-text keys of data items (meta keys excluded). */
  async keys(): Promise<string[]> {
    return (await this.kv.keys()).filter((k) => !k.startsWith('meta:'));
  }

  /** Data items exactly as stored (still encrypted). */
  async rawItems(): Promise<Array<[string, string]>> {
    const out: Array<[string, string]> = [];
    for (const k of await this.keys()) {
      const v = await this.kv.get(k);
      if (v !== undefined) out.push([k, v]);
    }
    return out;
  }

  /** Data items decrypted to their JSON text. Never log the result. */
  async plaintextItems(): Promise<Array<[string, string]>> {
    const out: Array<[string, string]> = [];
    for (const [k, v] of await this.rawItems()) out.push([k, await decryptValue(this.key, v)]);
    return out;
  }

  /** Remove every data item, keeping the meta keys (used before a fresh setup and by import). */
  async clearData(): Promise<void> {
    for (const k of await this.keys()) await this.kv.delete(k);
  }

  private assertDataKey(key: string) {
    if (key.startsWith('meta:')) throw new Error('meta keys are managed by the vault');
  }
}

export async function hasVault(kv: KV): Promise<boolean> {
  return (await kv.get(META_VERIFIER)) !== undefined;
}

/** First run: choose a password and create the store. */
export async function createVault(
  kv: KV,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<Vault> {
  if (await hasVault(kv)) throw new Error('A store already exists');
  const salt = randomSalt();
  const key = await deriveKey(password, salt, iterations);
  await kv.put(META_SALT, toBase64(salt));
  await kv.put(META_ITERATIONS, String(iterations));
  await kv.put(META_VERSION, STORE_VERSION);
  await kv.put(META_VERIFIER, await encryptValue(key, VERIFIER_TEXT));
  return new Vault(kv, key);
}

/** Later runs: check the password against the verifier. Throws WrongPasswordError. */
export async function unlockVault(kv: KV, password: string): Promise<Vault> {
  const version = await kv.get(META_VERSION);
  if (version !== STORE_VERSION) {
    throw new Error(
      'This store was made by an older test build. In Chrome DevTools > Application > IndexedDB, delete the "scary-money-manager" database and reload.',
    );
  }
  const [saltB64, iterStr, verifier] = await Promise.all([
    kv.get(META_SALT),
    kv.get(META_ITERATIONS),
    kv.get(META_VERIFIER),
  ]);
  if (!saltB64 || !iterStr || !verifier) throw new Error('Store is missing its metadata');
  const key = await deriveKey(password, fromBase64(saltB64), Number(iterStr));
  let text: string;
  try {
    text = await decryptValue(key, verifier);
  } catch {
    throw new WrongPasswordError();
  }
  if (text !== VERIFIER_TEXT) throw new WrongPasswordError();
  return new Vault(kv, key);
}

export interface StoreMeta {
  salt: string;
  iterations: number;
  verifier: string;
}

export async function readMeta(kv: KV): Promise<StoreMeta> {
  const [salt, iterations, verifier] = await Promise.all([kv.get(META_SALT), kv.get(META_ITERATIONS), kv.get(META_VERIFIER)]);
  if (!salt || !iterations || !verifier) throw new Error('Store is missing its metadata');
  return { salt, iterations: Number(iterations), verifier };
}

/** The meta keys of a store, in the order they are written. */
export function metaEntries(meta: StoreMeta): Array<[string, string]> {
  return [
    [META_SALT, meta.salt],
    [META_ITERATIONS, String(meta.iterations)],
    [META_VERSION, STORE_VERSION],
    [META_VERIFIER, meta.verifier],
  ];
}

/**
 * Change the session password. The current password is checked first (WrongPasswordError otherwise).
 * Every value is re-encrypted under a new salt and key, and the store is replaced in one step, so a
 * failure part-way leaves the old store intact.
 */
export async function changePassword(
  kv: KV,
  currentPassword: string,
  newPassword: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<Vault> {
  const tooShort = passwordProblem(newPassword);
  if (tooShort) throw new Error(tooShort);
  const current = await unlockVault(kv, currentPassword);
  const plain = await current.plaintextItems();
  const salt = randomSalt();
  const key = await deriveKey(newPassword, salt, iterations);
  const entries = metaEntries({ salt: toBase64(salt), iterations, verifier: await encryptValue(key, VERIFIER_TEXT) });
  for (const [k, text] of plain) entries.push([k, await encryptValue(key, text)]);
  await kv.replaceAll(entries);
  return new Vault(kv, key);
}
/**
 * Delete the whole store: every entry, account, budget, goal and the password check. Afterwards the app
 * asks for a new password and starts from Setup. This cannot be undone.
 */
export async function nukeStore(kv: KV): Promise<void> {
  await kv.clear();
}
