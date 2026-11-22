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
import type { KV } from './kv';

// Fixed, readable keys (ADR-0001). Everything else is an opaque ID and its value is encrypted.
export const META_SALT = 'meta:salt';
export const META_VERIFIER = 'meta:verifier';
export const META_VERSION = 'meta:version';
export const META_ITERATIONS = 'meta:iterations';
export const STORE_VERSION = '1';

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
