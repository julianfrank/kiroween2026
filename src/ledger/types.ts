import type { Paise } from '../money/money';

export type AccountKind = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  /** Opaque key, e.g. "acct:7f3a". */
  key: string;
  name: string;
  kind: AccountKind;
  /** Asset accounts that Goals may attach to. */
  category?: 'savings' | 'investment' | null;
  /** Date the account's opening balance applies from. */
  asOfDate: string;
}

export interface Line {
  account: string;
  debitPaise: Paise;
  creditPaise: Paise;
}

export type EntryKind = 'opening' | 'normal' | 'revaluation' | 'reversal' | 'correction';
export type EntrySource = 'setup' | 'ai-confirmed' | 'manual-form';

export interface Entry {
  date: string; // YYYY-MM-DD
  note: string;
  lines: Line[];
  kind: EntryKind;
  /** Key of the entry this one reverses. */
  reverses: string | null;
  /** Key of the original entry this one corrects. */
  correctionOf: string | null;
  source: EntrySource;
}

/** Debit-normal kinds grow with debits; the others grow with credits. */
export const DEBIT_NORMAL: ReadonlySet<AccountKind> = new Set(['asset', 'expense']);
