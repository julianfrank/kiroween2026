// Checks every decrypted item of an Export File before anything in the browser is changed.
// The file may come from another tool, so nothing is trusted: shapes, links between items and the
// balance of every entry are all checked.

import { ALL_INTENTS, INTENTS } from '../chat/intents';
import { Ledger } from '../ledger/ledger';
import type { Account, AccountKind, Entry, Line } from '../ledger/types';
import { isValidDate, validateEntry } from '../rules/rules';
import type { LoadedData } from '../store/repo';
import type { Budget, Goal } from '../targets/types';

export class ImportError extends Error {
  constructor(public readonly problems: string[]) {
    const shown = problems.slice(0, 5).join(' ');
    super(problems.length > 5 ? `${shown} (and ${problems.length - 5} more problems)` : shown);
    this.name = 'ImportError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isWhole = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;

const KINDS: AccountKind[] = ['asset', 'liability', 'equity', 'income', 'expense'];
const SYSTEM: Record<string, AccountKind> = { 'opening-equity': 'equity', 'valuation-gain': 'income', 'valuation-loss': 'expense' };
const ENTRY_KINDS: Entry['kind'][] = ['opening', 'normal', 'revaluation', 'reversal', 'correction'];
const SOURCES: Entry['source'][] = ['setup', 'ai-confirmed', 'manual-form'];
const LEDGER_INTENTS = ALL_INTENTS.filter((i) => !INTENTS[i].target);

function account(key: string, v: unknown, problems: string[]): Account | null {
  const bad = (why: string) => (problems.push(`${key}: ${why}.`), null);
  if (!isObj(v)) return bad('is not an object');
  if (!isText(v.name)) return bad('needs a name');
  if (!KINDS.includes(v.kind as AccountKind)) return bad(`kind must be one of ${KINDS.join(', ')}`);
  if (typeof v.asOfDate !== 'string' || !isValidDate(v.asOfDate)) return bad('asOfDate must be a YYYY-MM-DD date');
  if (v.category !== undefined && v.category !== null && v.category !== 'savings' && v.category !== 'investment') {
    return bad('category must be savings, investment or null');
  }
  if (v.category && v.kind !== 'asset') return bad('only asset accounts can have a category');
  if (v.system !== undefined) {
    if (!(typeof v.system === 'string' && v.system in SYSTEM)) return bad(`system must be one of ${Object.keys(SYSTEM).join(', ')}`);
    if (SYSTEM[v.system] !== v.kind) return bad(`a ${v.system} account must be of kind ${SYSTEM[v.system]}`);
  }
  return {
    key,
    name: v.name.trim(),
    kind: v.kind as AccountKind,
    asOfDate: v.asOfDate,
    ...(v.category !== undefined ? { category: v.category as Account['category'] } : {}),
    ...(v.system !== undefined ? { system: v.system as Account['system'] } : {}),
  };
}

function entry(key: string, v: unknown, problems: string[]): Entry | null {
  const bad = (why: string) => (problems.push(`${key}: ${why}.`), null);
  if (!isObj(v)) return bad('is not an object');
  if (typeof v.date !== 'string' || !isValidDate(v.date)) return bad('date must be a YYYY-MM-DD date');
  if (key.slice(4, 14) !== v.date) return bad('the date in the key must match the entry date');
  if (typeof v.note !== 'string') return bad('needs a note');
  if (!ENTRY_KINDS.includes(v.kind as Entry['kind'])) return bad(`kind must be one of ${ENTRY_KINDS.join(', ')}`);
  if (!SOURCES.includes(v.source as Entry['source'])) return bad(`source must be one of ${SOURCES.join(', ')}`);
  if (v.reverses !== null && typeof v.reverses !== 'string') return bad('reverses must be an entry key or null');
  if (v.correctionOf !== null && typeof v.correctionOf !== 'string') return bad('correctionOf must be an entry key or null');
  if (v.intent !== undefined && !LEDGER_INTENTS.includes(v.intent as never)) return bad(`intent must be one of ${LEDGER_INTENTS.join(', ')}`);
  if (!Array.isArray(v.lines)) return bad('lines must be a list');
  const lines: Line[] = [];
  for (const l of v.lines) {
    if (!isObj(l) || typeof l.account !== 'string' || !isWhole(l.debitRupees) || !isWhole(l.creditRupees)) {
      return bad('every line needs an account and whole-rupee debitRupees and creditRupees');
    }
    lines.push({ account: l.account, debitRupees: l.debitRupees, creditRupees: l.creditRupees });
  }
  return {
    date: v.date,
    note: v.note,
    lines,
    kind: v.kind as Entry['kind'],
    reverses: v.reverses as string | null,
    correctionOf: v.correctionOf as string | null,
    source: v.source as Entry['source'],
    ...(v.intent !== undefined ? { intent: v.intent as Entry['intent'] } : {}),
  };
}

/** Turn decrypted items into app data, or throw ImportError listing every problem found. */
export function validateItems(items: ReadonlyMap<string, unknown>): LoadedData {
  const problems: string[] = [];
  const accounts = new Map<string, Account>();
  const entries = new Map<string, Entry>();
  const budgets = new Map<string, Budget>();
  const goals = new Map<string, Goal>();

  for (const [key, v] of items) {
    if (key.startsWith('acct:')) {
      const a = account(key, v, problems);
      if (a) accounts.set(key, a);
    }
  }
  const names = new Map<string, string>();
  for (const a of accounts.values()) {
    const n = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (names.has(n)) problems.push(`${a.key}: the name "${a.name}" is already used by ${names.get(n)}.`);
    else names.set(n, a.key);
  }
  if (accounts.size > 0) {
    for (const [system, kind] of Object.entries(SYSTEM)) {
      const count = [...accounts.values()].filter((a) => a.system === system).length;
      if (count !== 1) problems.push(`The file needs exactly one ${kind} account marked "${system}" (found ${count}).`);
    }
  }

  for (const [key, v] of items) {
    if (!key.startsWith('txn:')) continue;
    const e = entry(key, v, problems);
    if (!e) continue;
    for (const p of validateEntry(e, accounts)) problems.push(`${key}: ${p}.`);
    entries.set(key, e);
  }
  const reversed = new Set<string>();
  for (const [key, e] of entries) {
    if (e.kind === 'reversal') {
      const target = e.reverses ? entries.get(e.reverses) : undefined;
      if (!target) problems.push(`${key}: reverses an entry that is not in the file.`);
      else if (target.kind === 'reversal') problems.push(`${key}: a reversal cannot be reversed.`);
      else if (reversed.has(e.reverses!)) problems.push(`${key}: ${e.reverses} is reversed more than once.`);
      else reversed.add(e.reverses!);
    } else if (e.reverses) problems.push(`${key}: only a reversal can have "reverses".`);
    if (e.kind === 'correction' && !(e.correctionOf && entries.has(e.correctionOf))) {
      problems.push(`${key}: corrects an entry that is not in the file.`);
    }
  }

  for (const [key, v] of items) {
    if (key.startsWith('budget:')) {
      if (!isObj(v) || !isText(v.name) || !isWhole(v.monthlyLimitRupees, 1) || !Array.isArray(v.accounts) || v.accounts.length === 0) {
        problems.push(`${key}: a budget needs a name, a whole-rupee monthlyLimitRupees above zero and a list of accounts.`);
        continue;
      }
      const bad = v.accounts.filter((k) => typeof k !== 'string' || accounts.get(k)?.kind !== 'expense');
      if (bad.length) problems.push(`${key}: every budget account must be an expense account in the file.`);
      else budgets.set(key, { name: v.name, monthlyLimitRupees: v.monthlyLimitRupees, accounts: v.accounts as string[] });
    } else if (key.startsWith('goal:')) {
      if (!isObj(v) || !isText(v.name) || !isWhole(v.targetRupees, 1) || typeof v.account !== 'string') {
        problems.push(`${key}: a goal needs a name, a whole-rupee targetRupees above zero and an account.`);
        continue;
      }
      if (v.targetDate !== null && !(typeof v.targetDate === 'string' && isValidDate(v.targetDate))) {
        problems.push(`${key}: targetDate must be a YYYY-MM-DD date or null.`);
        continue;
      }
      const a = accounts.get(v.account);
      if (!a || a.kind !== 'asset' || (a.category !== 'savings' && a.category !== 'investment')) {
        problems.push(`${key}: the goal account must be a savings or investment account in the file.`);
        continue;
      }
      goals.set(key, { name: v.name, targetRupees: v.targetRupees, targetDate: v.targetDate as string | null, account: v.account });
    }
  }

  if (problems.length) throw new ImportError(problems);

  const ledger = new Ledger(accounts);
  for (const [key, e] of [...entries].sort(([a], [b]) => a.localeCompare(b))) ledger.load(key, e);

  // The balance check: across the whole ledger, debits equal credits (so Assets = Liabilities + Equity
  // + Income - Expenses holds).
  let debit = 0;
  let credit = 0;
  for (const e of entries.values()) for (const l of e.lines) (debit += l.debitRupees), (credit += l.creditRupees);
  if (debit !== credit) throw new ImportError([`The books do not balance: debits ${debit}, credits ${credit}.`]);

  return { accounts, ledger, budgets, goals };
}
