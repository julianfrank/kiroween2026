import { describe, expect, it } from 'vitest';
import { delayAfterFailures } from '../crypto/attempts';
import { decryptValue, deriveKey, encryptValue, randomSalt } from '../crypto/crypto';
import { MemoryKV } from './kv';
import { WrongPasswordError, createVault, hasVault, unlockVault } from './vault';

const FAST = 1000; // iterations for tests only

describe('crypto', () => {
  it('round-trips a value', async () => {
    const key = await deriveKey('pw', randomSalt(), FAST);
    const blob = await encryptValue(key, 'hello ₹5,000');
    expect(await decryptValue(key, blob)).toBe('hello ₹5,000');
  });

  it('uses a different IV each time', async () => {
    const key = await deriveKey('pw', randomSalt(), FAST);
    expect(await encryptValue(key, 'same')).not.toBe(await encryptValue(key, 'same'));
  });

  it('rejects a wrong key and tampered data', async () => {
    const salt = randomSalt();
    const good = await deriveKey('pw', salt, FAST);
    const bad = await deriveKey('other', salt, FAST);
    const blob = await encryptValue(good, 'secret');
    await expect(decryptValue(bad, blob)).rejects.toThrow();
    const tampered = blob.slice(0, -4) + (blob.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(decryptValue(good, tampered)).rejects.toThrow();
  });
});

describe('vault', () => {
  it('creates a store, then unlocks it with the same password', async () => {
    const kv = new MemoryKV();
    expect(await hasVault(kv)).toBe(false);
    const v = await createVault(kv, 'Pass#1', FAST);
    await v.putJson('acct:7f3a', { name: 'Loan - Tom', paise: 500000 });
    expect(await hasVault(kv)).toBe(true);

    const again = await unlockVault(kv, 'Pass#1');
    expect(await again.getJson('acct:7f3a')).toEqual({ name: 'Loan - Tom', paise: 500000 });
    expect(await again.keys()).toEqual(['acct:7f3a']);
  });

  it('rejects a wrong password', async () => {
    const kv = new MemoryKV();
    await createVault(kv, 'right', FAST);
    await expect(unlockVault(kv, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('keeps no plaintext in stored keys or values', async () => {
    const kv = new MemoryKV();
    const v = await createVault(kv, 'right', FAST);
    await v.putJson('acct:7f3a', { name: 'Loan from Tom', paise: 123456789 });
    const everything = [...kv.data.entries()].flat().join('\n');
    expect(everything).not.toContain('Tom');
    expect(everything).not.toContain('123456789');
    expect(everything).not.toContain('Kiroween2026');
    expect(kv.data.get('meta:version')).toBe('1');
  });

  it('refuses to create over an existing store and to write meta keys', async () => {
    const kv = new MemoryKV();
    const v = await createVault(kv, 'pw', FAST);
    await expect(createVault(kv, 'pw2', FAST)).rejects.toThrow();
    await expect(v.putJson('meta:salt', 'x')).rejects.toThrow();
  });
});

describe('wrong-password delay', () => {
  it('grows 1s, 2s, 4s and is capped', () => {
    expect([0, 1, 2, 3, 4].map((n) => delayAfterFailures(n))).toEqual([0, 1000, 2000, 4000, 8000]);
    expect(delayAfterFailures(20)).toBe(30_000);
  });
});
