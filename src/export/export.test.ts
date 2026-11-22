import { describe, expect, it } from 'vitest';
import { AiHost } from '../ai/host';
import type { SessionLike } from '../ai/readiness';
import { encryptValue, deriveKey, fromBase64 } from '../crypto/crypto';
import { istTimestamp } from '../dates/dates';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import { MemoryKV } from '../store/kv';
import { commitTarget, loadAll, saveSetup } from '../store/repo';
import { WrongPasswordError, changePassword, createVault, unlockVault } from '../store/vault';
import {
  ITEM_KEY,
  exportFileName,
  exportWithCurrentPassword,
  exportWithNewPassword,
  importExportFile,
  openExport,
  parseEnvelope,
  type ExportEnvelope,
} from './format';
import { EXAMPLE_VALUES, buildTemplate } from './template';
import { ImportError, validateItems } from './validate';

const TODAY = '2026-11-22';
const IT = 100_000; // the smallest count the importer accepts; keeps the tests quick
const NOW = new Date('2026-11-22T10:00:00Z');

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2020', ...over };
}

/** A browser store with real-looking books, unlocked with `password`. */
async function store(password: string, names = ['Cash', 'Chennai']) {
  const rows = [
    row({ name: names[0], amountText: '1,00,000' }),
    row({ name: names[1], amountText: '1cr', asOfText: '10/Jul/2025' }),
    row({ kind: 'liability', name: 'Dubakur Bank - Home Loan', amountText: '50L', asOfText: '10/Jul/2025' }),
  ];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const kv = new MemoryKV();
  const vault = await createVault(kv, password, IT);
  await saveSetup(vault, accounts, ledger.entries);
  const data = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const food = [...accounts.values()].find((a) => a.name === 'Food')!;
  await commitTarget(vault, data, [], { kind: 'budget', key: 'budget:b1', budget: { name: 'Food', monthlyLimitRupees: 8000, accounts: [food.key] } });
  return { kv, vault, data };
}

const snapshot = (kv: MemoryKV) => JSON.stringify([...kv.data.entries()].sort());
const text = (env: ExportEnvelope) => JSON.stringify(env);

describe('export', () => {
  it('with the current password: one envelope, plain keys, encrypted values, IST timestamp', async () => {
    const s = await store('pw-A');
    const env = await exportWithCurrentPassword(s.kv, s.vault, NOW);
    expect(env).toMatchObject({ format: 'scary-money-manager-export', version: 1, cipher: 'AES-256-GCM', exportedAt: '2026-11-22T15:30:00+05:30' });
    expect(env.kdf).toMatchObject({ name: 'PBKDF2-SHA256', iterations: IT });
    expect(Object.keys(env.items)).toContain('meta:verifier');
    for (const k of Object.keys(env.items)) expect(k).toMatch(ITEM_KEY);
    const t = text(env);
    for (const secret of ['Cash', 'Chennai', 'Dubakur', '8000', 'Kiroween2026', 'pw-A']) expect(t).not.toContain(secret);
    expect(exportFileName(NOW)).toBe('scary-money-manager-2026-11-22.json');
  });

  it('round trip: what is exported opens with the same password and gives the same books', async () => {
    const s = await store('pw-A');
    const opened = await openExport(parseEnvelope(text(await exportWithCurrentPassword(s.kv, s.vault))), 'pw-A');
    expect(opened.data.accounts.size).toBe(s.data.accounts.size);
    expect(opened.data.ledger.entries.size).toBe(s.data.ledger.entries.size);
    expect(opened.data.ledger.netWorth()).toBe(s.data.ledger.netWorth());
    expect([...opened.data.budgets.values()]).toEqual([...s.data.budgets.values()]);
  });

  it('with a different password: the file needs the new one, the browser keeps the old one', async () => {
    const s = await store('pw-A');
    const before = snapshot(s.kv);
    const env = await exportWithNewPassword(s.vault, 'file-pw', NOW, IT);
    await expect(openExport(parseEnvelope(text(env)), 'pw-A')).rejects.toBeInstanceOf(WrongPasswordError);
    const opened = await openExport(parseEnvelope(text(env)), 'file-pw');
    expect(opened.data.ledger.netWorth()).toBe(s.data.ledger.netWorth());
    expect(snapshot(s.kv)).toBe(before);
    await expect(unlockVault(s.kv, 'pw-A')).resolves.toBeTruthy();
  });
});

describe('import', () => {
  it('replaces everything, and the file password becomes the session password', async () => {
    const a = await store('pw-A', ['Cash', 'Chennai']);
    const file = text(await exportWithCurrentPassword(a.kv, a.vault));
    const b = await store('pw-B', ['Wallet', 'Mumbai flat']);

    const { vault, data } = await importExportFile(b.kv, file, 'pw-A', () => {});
    expect([...data.accounts.values()].some((x) => x.name === 'Chennai')).toBe(true);
    const reloaded = await loadAll(vault);
    expect([...reloaded.accounts.values()].map((x) => x.name)).not.toContain('Wallet');
    expect([...reloaded.accounts.values()].map((x) => x.name)).toContain('Chennai');
    expect(reloaded.ledger.netWorth()).toBe(a.data.ledger.netWorth());
    await expect(unlockVault(b.kv, 'pw-B')).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(unlockVault(b.kv, 'pw-A')).resolves.toBeTruthy();
  });

  it('a wrong password changes nothing and never reaches the replace step', async () => {
    const a = await store('pw-A');
    const file = text(await exportWithCurrentPassword(a.kv, a.vault));
    const b = await store('pw-B', ['Wallet', 'Mumbai flat']);
    const before = snapshot(b.kv);
    let replaced = false;
    await expect(importExportFile(b.kv, file, 'nope', () => (replaced = true))).rejects.toBeInstanceOf(WrongPasswordError);
    expect(replaced).toBe(false);
    expect(snapshot(b.kv)).toBe(before);
  });

  it('destroys the AI session before the store is replaced, so the old session cannot answer', async () => {
    const a = await store('pw-A');
    const file = text(await exportWithCurrentPassword(a.kv, a.vault));
    const b = await store('pw-B', ['Wallet', 'Mumbai flat']);
    let destroyed = false;
    const old: SessionLike = {
      prompt: async () => {
        if (destroyed) throw Object.assign(new Error('The model execution session has been destroyed.'), { name: 'InvalidStateError' });
        return 'remembered Wallet';
      },
      destroy: () => void (destroyed = true),
    };
    const fresh: SessionLike = { prompt: async () => 'fresh', destroy: () => {} };
    const host = new AiHost(async () => fresh);
    host.adopt(old);
    const order: string[] = [];
    const realReplace = b.kv.replaceAll.bind(b.kv);
    b.kv.replaceAll = async (e) => (order.push('replace'), realReplace(e));

    await importExportFile(b.kv, file, 'pw-A', () => (order.push('destroy'), host.destroy()));
    expect(order).toEqual(['destroy', 'replace']);
    await expect(old.prompt('what was the last account?')).rejects.toMatchObject({ name: 'InvalidStateError' });
    await expect(host.prompt('hi')).rejects.toThrow('not ready');
    await host.renew();
    await expect(host.prompt('hi')).resolves.toBe('fresh');
  });

  it('rejects broken files with reasons, before any change', async () => {
    const a = await store('pw-A');
    const env = await exportWithCurrentPassword(a.kv, a.vault);
    const bad = (mut: (e: ExportEnvelope) => void) => {
      const copy = JSON.parse(text(env)) as ExportEnvelope;
      mut(copy);
      return JSON.stringify(copy);
    };
    expect(() => parseEnvelope('not json')).toThrow(ImportError);
    expect(() => parseEnvelope(bad((e) => ((e as { format: string }).format = 'other')))).toThrow(/format/);
    expect(() => parseEnvelope(bad((e) => (e.kdf.iterations = 10)))).toThrow(/iterations/);
    expect(() => parseEnvelope(bad((e) => (e.items['acct:Loan from Tom'] = 'AAAA')))).toThrow(/not allowed/);
    expect(() => parseEnvelope(bad((e) => delete (e.items as Record<string, string>)['meta:verifier']))).toThrow(/meta:verifier/);

    // A value that was changed in the file no longer decrypts.
    const someKey = Object.keys(env.items).find((k) => k.startsWith('acct:'))!;
    const tampered = bad((e) => (e.items[someKey] = e.items[someKey].slice(0, -6) + 'AAAAAA'));
    await expect(openExport(parseEnvelope(tampered), 'pw-A')).rejects.toThrow(/could not be decrypted/);
  });

  it('rejects an unbalanced entry written by another tool', async () => {
    const a = await store('pw-A');
    const env = await exportWithCurrentPassword(a.kv, a.vault);
    const key = await deriveKey('pw-A', fromBase64(env.kdf.salt), env.kdf.iterations);
    const cash = [...a.data.accounts.values()].find((x) => x.name === 'Cash')!.key;
    const food = [...a.data.accounts.values()].find((x) => x.name === 'Food')!.key;
    env.items['txn:2026-11-20:0001'] = await encryptValue(
      key,
      JSON.stringify({
        date: '2026-11-20', note: 'bad', kind: 'normal', reverses: null, correctionOf: null, source: 'manual-form',
        lines: [{ account: food, debitRupees: 900, creditRupees: 0 }, { account: cash, debitRupees: 0, creditRupees: 800 }],
      }),
    );
    const b = await store('pw-B', ['Wallet', 'Mumbai flat']);
    const before = snapshot(b.kv);
    await expect(importExportFile(b.kv, text(env), 'pw-A', () => {})).rejects.toThrow(/Debits \(900\) must equal credits \(800\)/);
    expect(snapshot(b.kv)).toBe(before);
  });
});

describe('item checks', () => {
  const items = () => new Map(Object.entries(JSON.parse(JSON.stringify(EXAMPLE_VALUES))));

  it('the template example is a valid, balanced set of books', () => {
    const data = validateItems(items());
    expect(data.accounts.size).toBe(7);
    expect(data.ledger.entries.size).toBe(3);
    expect(data.ledger.netWorth()).toBe(20000 + 5000 - 800 - 5000);
    expect(data.budgets.size).toBe(1);
    expect(data.goals.size).toBe(1);
  });

  it('catches wrong shapes, broken links, missing app accounts and duplicate names', () => {
    const cases: Array<[(m: Map<string, unknown>) => void, RegExp]> = [
      [(m) => m.set('acct:1a2b', { name: 'Cash', kind: 'wallet', asOfDate: '2026-11-01' }), /kind must be one of/],
      [(m) => m.set('acct:dupe', { name: 'cash', kind: 'asset', asOfDate: '2026-11-01' }), /already used/],
      [(m) => m.delete('acct:0e02'), /valuation-gain/],
      [(m) => m.set('txn:2026-11-05:0001', { ...(m.get('txn:2026-11-03:0001') as object) }), /date in the key/],
      [(m) => m.set('txn:2026-11-03:0001', { ...(m.get('txn:2026-11-03:0001') as object), lines: [{ account: 'acct:9c1d', debitRupees: 80.5, creditRupees: 0 }] }), /whole-rupee/],
      [(m) => m.set('txn:2026-11-04:0001', { date: '2026-11-04', note: 'r', kind: 'reversal', reverses: 'txn:2099-01-01:0001', correctionOf: null, source: 'manual-form', lines: [{ account: 'acct:1a2b', debitRupees: 1, creditRupees: 0 }, { account: 'acct:9c1d', debitRupees: 0, creditRupees: 1 }] }), /not in the file/],
      [(m) => m.set('budget:5d6e', { name: 'Food', monthlyLimitRupees: 8000, accounts: ['acct:1a2b'] }), /expense account/],
      [(m) => m.set('goal:8f9a', { name: 'x', targetRupees: 10, targetDate: null, account: 'acct:1a2b' }), /savings or investment/],
    ];
    for (const [mutate, expected] of cases) {
      const m = items();
      mutate(m);
      expect(() => validateItems(m)).toThrow(expected);
    }
  });

  it('an empty export (no accounts yet) is allowed, so the app goes to setup', () => {
    expect(validateItems(new Map()).accounts.size).toBe(0);
  });
});

describe('password change', () => {
  it('needs the current password, re-encrypts everything, and keeps the data', async () => {
    const s = await store('old-pw');
    const before = snapshot(s.kv);
    await expect(changePassword(s.kv, 'wrong', 'new-pw', IT)).rejects.toBeInstanceOf(WrongPasswordError);
    expect(snapshot(s.kv)).toBe(before);

    const v = await changePassword(s.kv, 'old-pw', 'new-pw', IT);
    expect(s.kv.data.get('meta:salt')).not.toBe(JSON.parse(before).find(([k]: [string]) => k === 'meta:salt')[1]);
    await expect(unlockVault(s.kv, 'old-pw')).rejects.toBeInstanceOf(WrongPasswordError);
    const again = await loadAll(await unlockVault(s.kv, 'new-pw'));
    expect(again.ledger.netWorth()).toBe(s.data.ledger.netWorth());
    expect((await loadAll(v)).accounts.size).toBe(s.data.accounts.size);
    // every value changed ciphertext
    const old = new Map<string, string>(JSON.parse(before));
    for (const [k, val] of s.kv.data) if (k.startsWith('acct:')) expect(val).not.toBe(old.get(k));
  });
});

describe('template', () => {
  it('describes the same key pattern the importer uses and lists the rules', () => {
    const t = buildTemplate();
    expect(t.envelopeSchema.properties.items.propertyNames.pattern).toBe(ITEM_KEY.source);
    expect(t.rules.join(' ')).toContain('Kiroween2026');
    expect(Object.keys(t.exampleEnvelope.items)).toEqual(['meta:verifier', ...Object.keys(EXAMPLE_VALUES)]);
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe('IST timestamp', () => {
  it('is IST with +05:30', () => {
    expect(istTimestamp(new Date('2026-11-21T20:00:00Z'))).toBe('2026-11-22T01:30:00+05:30');
  });
});
