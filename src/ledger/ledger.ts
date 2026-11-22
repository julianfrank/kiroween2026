import type { Rupees } from '../money/money';
import { validateEntry } from '../rules/rules';
import { DEBIT_NORMAL, type Account, type Entry, type Line } from './types';

export class LedgerError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('; '));
    this.name = 'LedgerError';
  }
}

/**
 * In-memory, append-only ledger. There is deliberately no update or delete method (ADR-0002).
 * Persistence is layered on top by the caller.
 */
export class Ledger {
  private readonly _entries = new Map<string, Entry>();

  constructor(private readonly accounts: ReadonlyMap<string, Account>) {}

  get entries(): ReadonlyMap<string, Entry> {
    return this._entries;
  }

  /** Load already-stored entries (they were validated when first written). */
  load(key: string, entry: Entry) {
    this._entries.set(key, entry);
  }

  /** Append one entry after the Rules Engine accepts it. Returns its key, e.g. "txn:2026-11-22:0001". */
  append(entry: Entry): string {
    const key = this.preview(entry);
    this._entries.set(key, entry);
    return key;
  }

  /** Validate an entry and return the key it would get, without storing it (so callers can save first). */
  preview(entry: Entry): string {
    const problems = validateEntry(entry, this.accounts);
    if (entry.reverses) {
      const target = this._entries.get(entry.reverses);
      if (!target) problems.push(`Cannot reverse unknown entry ${entry.reverses}`);
      else if (target.kind === 'reversal') problems.push('Cannot reverse a reversal');
      else if (this.isReversed(entry.reverses)) problems.push(`${entry.reverses} is already reversed`);
    }
    if (problems.length) throw new LedgerError(problems);
    return this.nextKey(entry.date);
  }

  isReversed(key: string): boolean {
    for (const e of this._entries.values()) if (e.reverses === key) return true;
    return false;
  }

  /** Post a Reversal that cancels `key` exactly. The note says why. */
  reverse(key: string, date: string, reason: string): string {
    const original = this.mustGet(key);
    return this.append({
      date,
      note: `Reversal of ${key} (${original.note}): ${reason}`,
      lines: original.lines.map((l) => ({
        account: l.account,
        debitRupees: l.creditRupees,
        creditRupees: l.debitRupees,
      })),
      kind: 'reversal',
      reverses: key,
      correctionOf: null,
      source: original.source,
    });
  }

  /** Reverse `key`, then post the corrected entry. Returns both new keys. */
  correct(
    key: string,
    date: string,
    reason: string,
    lines: Line[],
    note: string,
  ): { reversal: string; correction: string } {
    const original = this.mustGet(key);
    const reversal = this.reverse(key, date, reason);
    try {
      const correction = this.append({
        date,
        note: `Correction of ${key}: ${note}`,
        lines,
        kind: 'correction',
        reverses: null,
        correctionOf: key,
        source: original.source,
      });
      return { reversal, correction };
    } catch (e) {
      this._entries.delete(reversal); // keep the books as they were if the correction is invalid
      throw e;
    }
  }

  /** Balance of one account on or before `asOf` (inclusive), in its normal direction. */
  balance(accountKey: string, asOf?: string): Rupees {
    const account = this.accounts.get(accountKey);
    if (!account) throw new Error(`Unknown account ${accountKey}`);
    let sum = 0;
    for (const e of this._entries.values()) {
      if (asOf && e.date > asOf) continue;
      for (const l of e.lines) {
        if (l.account === accountKey) sum += l.debitRupees - l.creditRupees;
      }
    }
    if (sum === 0) return 0; // avoid -0
    return DEBIT_NORMAL.has(account.kind) ? sum : -sum;
  }

  /** Total assets minus total liabilities on or before `asOf`. */
  netWorth(asOf?: string): Rupees {
    let total = 0;
    for (const a of this.accounts.values()) {
      if (a.kind === 'asset') total += this.balance(a.key, asOf);
      if (a.kind === 'liability') total -= this.balance(a.key, asOf);
    }
    return total;
  }

  private mustGet(key: string): Entry {
    const e = this._entries.get(key);
    if (!e) throw new LedgerError([`Unknown entry ${key}`]);
    return e;
  }

  private nextKey(date: string): string {
    const prefix = `txn:${date}:`;
    let max = 0;
    for (const k of this._entries.keys()) {
      if (k.startsWith(prefix)) max = Math.max(max, Number(k.slice(prefix.length)));
    }
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }
}
