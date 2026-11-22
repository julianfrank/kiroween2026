import { formatDate, parseDisplayDate } from '../dates/dates';
import { Ledger } from '../ledger/ledger';
import type { Account, Entry } from '../ledger/types';
import { parseRupees, type Rupees } from '../money/money';
import { isSetupBalanced, setupImbalance } from '../rules/rules';

export interface DraftRow {
  id: string;
  kind: 'asset' | 'liability';
  category: 'savings' | 'investment' | null;
  name: string;
  amountText: string;
  /** As typed by the user, e.g. "10/May/2000". */
  asOfText: string;
}

export interface OpeningLine {
  id: string;
  kind: 'asset' | 'liability';
  category: 'savings' | 'investment' | null;
  name: string;
  amountRupees: Rupees;
  asOfDate: string;
}

export interface DraftEvaluation {
  lines: OpeningLine[];
  rowErrors: Map<string, string>;
  equityError: string | null;
  assets: Rupees;
  liabilities: Rupees;
  equity: Rupees;
  imbalance: Rupees;
  canContinue: boolean;
}

/** Parse an amount that may start with "-" (Opening Equity can be negative). Blank means zero. */
export function parseSignedRupees(text: string): Rupees | null {
  const t = text.trim();
  if (t === '') return 0;
  if (t.startsWith('-')) {
    const p = parseRupees(t.slice(1));
    return p === null ? null : -p;
  }
  return parseRupees(t);
}

const RESERVED_NAMES = new Set(['opening equity', 'valuation gain', 'valuation loss']);

export function evaluateDraft(
  rows: DraftRow[],
  equityText: string,
  today: string,
): DraftEvaluation {
  const lines: OpeningLine[] = [];
  const rowErrors = new Map<string, string>();
  const seen = new Set<string>();

  for (const r of rows) {
    const name = r.name.trim();
    if (name === '' && r.amountText.trim() === '') continue; // untouched row
    const lower = name.toLowerCase();
    const amount = parseRupees(r.amountText);
    const asOf = parseDisplayDate(r.asOfText);
    if (name === '') rowErrors.set(r.id, 'Give it a name');
    else if (RESERVED_NAMES.has(lower)) rowErrors.set(r.id, 'This name is used by the app');
    else if (seen.has(lower)) rowErrors.set(r.id, 'Another row already uses this name');
    else if (amount === null) {
      rowErrors.set(r.id, 'Enter whole rupees above zero, like 5,00,000 or 40L (no paise)');
    } else if (asOf === null) rowErrors.set(r.id, 'Enter the date as DD/MMM/YYYY, like 10/May/2000');
    else if (asOf > today) rowErrors.set(r.id, 'The as-of date cannot be in the future');
    seen.add(lower);
    if (!rowErrors.has(r.id) && amount !== null && asOf !== null) {
      lines.push({
        id: r.id,
        kind: r.kind,
        category: r.kind === 'asset' ? r.category : null,
        name,
        amountRupees: amount,
        asOfDate: asOf,
      });
    }
  }

  const parsedEquity = parseSignedRupees(equityText);
  const equityError = parsedEquity === null ? 'Enter a number like 25,00,000 or -50,000' : null;
  const equity = parsedEquity ?? 0;
  const assets = lines.filter((l) => l.kind === 'asset').reduce((s, l) => s + l.amountRupees, 0);
  const liabilities = lines
    .filter((l) => l.kind === 'liability')
    .reduce((s, l) => s + l.amountRupees, 0);
  const imbalance = setupImbalance({ assets, liabilities, equity });

  return {
    lines,
    rowErrors,
    equityError,
    assets,
    liabilities,
    equity,
    imbalance,
    canContinue:
      rowErrors.size === 0 && equityError === null && lines.length > 0 && imbalance === 0,
  };
}

/** What "use difference" fills in: Assets minus Liabilities. */
export function differenceEquity(assets: Rupees, liabilities: Rupees): Rupees {
  return assets - liabilities;
}

export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `${prefix}:${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const STARTERS: Array<Pick<Account, 'name' | 'kind' | 'category' | 'system'>> = [
  { name: 'Opening Equity', kind: 'equity', system: 'opening-equity' },
  { name: 'Valuation Gain', kind: 'income', system: 'valuation-gain' },
  { name: 'Valuation Loss', kind: 'expense', system: 'valuation-loss' },
  { name: 'Salary', kind: 'income' },
  { name: 'Other Income', kind: 'income' },
  { name: 'Food', kind: 'expense' },
  { name: 'Rent', kind: 'expense' },
  { name: 'Transport', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Other Expense', kind: 'expense' },
  { name: 'Savings', kind: 'asset', category: 'savings' },
  { name: 'Investments', kind: 'asset', category: 'investment' },
];

export interface SetupResult {
  accounts: Map<string, Account>;
  ledger: Ledger;
}

/**
 * Turn a balanced draft into accounts plus one dated opening entry per opening line.
 * Throws if the draft is not exactly balanced (the Rules Engine gate).
 */
export function buildSetup(
  lines: OpeningLine[],
  equity: Rupees,
  today: string,
  makeId: (prefix: string) => string = newId,
): SetupResult {
  const assets = lines.filter((l) => l.kind === 'asset').reduce((s, l) => s + l.amountRupees, 0);
  const liabilities = lines
    .filter((l) => l.kind === 'liability')
    .reduce((s, l) => s + l.amountRupees, 0);
  if (!isSetupBalanced({ assets, liabilities, equity })) {
    throw new Error('Setup is not balanced: Assets must equal Liabilities plus Opening Equity');
  }

  const accounts = new Map<string, Account>();
  const userAssetNames = new Set(
    lines.filter((l) => l.kind === 'asset').map((l) => l.name.toLowerCase()),
  );
  const lineAccount = new Map<string, string>(); // line id -> account key

  for (const s of STARTERS) {
    // A user's own asset row named like a starter asset (e.g. "Savings") replaces that starter.
    if (s.kind === 'asset' && userAssetNames.has(s.name.toLowerCase())) continue;
    const key = makeId('acct');
    accounts.set(key, { key, ...s, asOfDate: today });
  }
  for (const l of lines) {
    const key = makeId('acct');
    lineAccount.set(l.id, key);
    accounts.set(key, {
      key,
      name: l.name,
      kind: l.kind,
      category: l.category,
      asOfDate: l.asOfDate,
    });
  }

  const equityKey = [...accounts.values()].find((a) => a.system === 'opening-equity')!.key;
  const ledger = new Ledger(accounts);
  for (const l of [...lines].sort((a, b) => a.asOfDate.localeCompare(b.asOfDate))) {
    const acct = lineAccount.get(l.id)!;
    const isAsset = l.kind === 'asset';
    const entry: Entry = {
      date: l.asOfDate,
      note: `Opening balance: ${l.name}, as of ${formatDate(l.asOfDate)}`,
      kind: 'opening',
      reverses: null,
      correctionOf: null,
      source: 'setup',
      lines: [
        { account: acct, debitRupees: isAsset ? l.amountRupees : 0, creditRupees: isAsset ? 0 : l.amountRupees },
        { account: equityKey, debitRupees: isAsset ? 0 : l.amountRupees, creditRupees: isAsset ? l.amountRupees : 0 },
      ],
    };
    ledger.append(entry);
  }
  return { accounts, ledger };
}
