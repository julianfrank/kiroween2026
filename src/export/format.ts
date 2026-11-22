// The Export File: one JSON envelope with plain-text keys and encrypted values (ADR-0001).
// Format reference: ideas/scary-money-manager/design/export-format.md and src/export/template.ts.

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
import { istTimestamp } from '../dates/dates';
import type { KV } from '../store/kv';
import type { LoadedData } from '../store/repo';
import { META_VERIFIER, Vault, WrongPasswordError, metaEntries, readMeta } from '../store/vault';
import { ImportError, validateItems } from './validate';

export const EXPORT_FORMAT = 'scary-money-manager-export';
export const EXPORT_VERSION = 1;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 10_000_000;
/** Allowed item keys. Keys never hold names or amounts. */
export const ITEM_KEY = /^(meta:verifier|(acct|budget|goal):[a-z0-9]+|txn:\d{4}-\d{2}-\d{2}:\d{4})$/;

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string };
  cipher: 'AES-256-GCM';
  items: Record<string, string>;
}

function envelope(salt: string, iterations: number, items: Array<[string, string]>, now: Date): ExportEnvelope {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: istTimestamp(now),
    kdf: { name: 'PBKDF2-SHA256', iterations, salt },
    cipher: 'AES-256-GCM',
    items: Object.fromEntries(items),
  };
}

/** Export with the session password: the stored ciphertext is copied as it is, so nothing is decrypted. */
export async function exportWithCurrentPassword(kv: KV, vault: Vault, now = new Date()): Promise<ExportEnvelope> {
  const meta = await readMeta(kv);
  return envelope(meta.salt, meta.iterations, [[META_VERIFIER, meta.verifier], ...(await vault.rawItems())], now);
}

/** Export under a different password. The browser's store keeps its own password. */
export async function exportWithNewPassword(
  vault: Vault,
  password: string,
  now = new Date(),
  iterations = DEFAULT_ITERATIONS,
): Promise<ExportEnvelope> {
  if (password.length === 0) throw new Error('Choose a password for the file.');
  const salt = randomSalt();
  const key = await deriveKey(password, salt, iterations);
  const items: Array<[string, string]> = [[META_VERIFIER, await encryptValue(key, VERIFIER_TEXT)]];
  for (const [k, text] of await vault.plaintextItems()) items.push([k, await encryptValue(key, text)]);
  return envelope(toBase64(salt), iterations, items, now);
}

export function exportFileName(now = new Date()): string {
  return `scary-money-manager-${istTimestamp(now).slice(0, 10)}.json`;
}

/** Read and check the outer envelope. Throws ImportError with a reason. Nothing is decrypted yet. */
export function parseEnvelope(text: string): ExportEnvelope {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new ImportError(['The file is not JSON.']);
  }
  const problems: string[] = [];
  const o = v as Record<string, unknown>;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new ImportError(['The file is not a JSON object.']);
  if (o.format !== EXPORT_FORMAT) problems.push(`"format" must be "${EXPORT_FORMAT}".`);
  if (o.version !== EXPORT_VERSION) problems.push(`"version" must be ${EXPORT_VERSION}.`);
  if (o.cipher !== 'AES-256-GCM') problems.push('"cipher" must be "AES-256-GCM".');
  const kdf = o.kdf as Record<string, unknown> | undefined;
  if (!kdf || kdf.name !== 'PBKDF2-SHA256') problems.push('"kdf.name" must be "PBKDF2-SHA256".');
  else {
    const it = kdf.iterations;
    if (!Number.isSafeInteger(it) || (it as number) < MIN_ITERATIONS || (it as number) > MAX_ITERATIONS) {
      problems.push(`"kdf.iterations" must be a whole number from ${MIN_ITERATIONS} to ${MAX_ITERATIONS}.`);
    }
    let saltOk = false;
    try {
      saltOk = typeof kdf.salt === 'string' && fromBase64(kdf.salt).length === 16;
    } catch {
      saltOk = false;
    }
    if (!saltOk) problems.push('"kdf.salt" must be 16 bytes in base64.');
  }
  const items = o.items as Record<string, unknown> | undefined;
  if (typeof items !== 'object' || items === null || Array.isArray(items)) problems.push('"items" must be an object.');
  else {
    if (typeof items[META_VERIFIER] !== 'string') problems.push('"items" must contain "meta:verifier".');
    for (const [k, val] of Object.entries(items)) {
      if (!ITEM_KEY.test(k)) problems.push(`Item key "${k.slice(0, 40)}" is not allowed.`);
      else if (typeof val !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(val)) problems.push(`Item "${k}" must be an encrypted base64 string.`);
    }
  }
  if (problems.length) throw new ImportError(problems);
  return v as ExportEnvelope;
}

export interface OpenedExport {
  envelope: ExportEnvelope;
  key: CryptoKey;
  data: LoadedData;
}

/** Check the password and every item. Throws WrongPasswordError or ImportError; changes nothing. */
export async function openExport(env: ExportEnvelope, password: string): Promise<OpenedExport> {
  const key = await deriveKey(password, fromBase64(env.kdf.salt), env.kdf.iterations);
  let verifier: string;
  try {
    verifier = await decryptValue(key, env.items[META_VERIFIER]);
  } catch {
    throw new WrongPasswordError();
  }
  if (verifier !== VERIFIER_TEXT) throw new WrongPasswordError();

  const decrypted = new Map<string, unknown>();
  const problems: string[] = [];
  for (const [k, v] of Object.entries(env.items)) {
    if (k === META_VERIFIER) continue;
    try {
      decrypted.set(k, JSON.parse(await decryptValue(key, v)));
    } catch {
      problems.push(`Item "${k}" could not be decrypted, or is not JSON.`);
    }
  }
  if (problems.length) throw new ImportError(problems);
  return { envelope: env, key, data: validateItems(decrypted) };
}

/**
 * Import a file, replacing everything in the browser. Order matters (design §9):
 * 1. parse, check the password and every item (any failure: nothing has changed),
 * 2. `beforeReplace` (the caller destroys the AI session and clears chat),
 * 3. replace the whole store in one step with the file's items and meta, so the file's password becomes
 *    the session password.
 */
export async function importExportFile(
  kv: KV,
  text: string,
  password: string,
  beforeReplace: () => void,
): Promise<{ vault: Vault; data: LoadedData }> {
  const opened = await openExport(parseEnvelope(text), password);
  beforeReplace();
  const { kdf, items } = opened.envelope;
  const entries = metaEntries({ salt: kdf.salt, iterations: kdf.iterations, verifier: items[META_VERIFIER] });
  for (const [k, v] of Object.entries(items)) if (k !== META_VERIFIER) entries.push([k, v]);
  await kv.replaceAll(entries);
  return { vault: new Vault(kv, opened.key), data: opened.data };
}
