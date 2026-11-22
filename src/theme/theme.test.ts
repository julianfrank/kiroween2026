import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../ledger/types';
import { eventFromEntry } from './events';
import { netWorthState } from './theme';

describe('Net Worth State', () => {
  it('is light when clearly positive, dark when clearly negative', () => {
    expect(netWorthState(1_000_000, 5_000_000)).toBe('light');
    expect(netWorthState(-1_000_000, 5_000_000)).toBe('dark');
  });

  it('is twilight within 5% of total assets of zero, on either side', () => {
    expect(netWorthState(0, 1000)).toBe('twilight');
    expect(netWorthState(50, 1000)).toBe('twilight'); // exactly 5%
    expect(netWorthState(-50, 1000)).toBe('twilight');
    expect(netWorthState(51, 1000)).toBe('light');
    expect(netWorthState(-51, 1000)).toBe('dark');
  });

  it('handles no assets at all', () => {
    expect(netWorthState(0, 0)).toBe('twilight');
    expect(netWorthState(-1, 0)).toBe('dark');
    expect(netWorthState(1, 0)).toBe('light');
    expect(netWorthState(-500, -200)).toBe('dark'); // negative asset totals count as no assets
  });

  it('has no memory: the same numbers always give the same state', () => {
    const seq = [100, -100, 100, 0, -100].map((nw) => netWorthState(nw, 1000));
    expect(seq).toEqual(['light', 'dark', 'light', 'twilight', 'dark']);
  });
});

const accounts = new Map<string, Account>(
  [
    ['a:cash', 'Cash', 'asset', undefined],
    ['a:food', 'Food', 'expense', undefined],
    ['a:salary', 'Salary', 'income', undefined],
    ['a:house', 'House', 'asset', undefined],
    ['a:gain', 'Valuation Gain', 'income', 'valuation-gain'],
    ['a:loss', 'Valuation Loss', 'expense', 'valuation-loss'],
  ].map(([key, name, kind, system]) => [
    key as string,
    { key, name, kind, system, asOfDate: '2026-01-01' } as Account,
  ]),
);

const entry = (over: Partial<Entry>, debit: string, credit: string): Entry => ({
  date: '2026-11-22',
  note: 'x',
  kind: 'normal',
  reverses: null,
  correctionOf: null,
  source: 'ai-confirmed',
  lines: [
    { account: debit, debitRupees: 800, creditRupees: 0 },
    { account: credit, debitRupees: 0, creditRupees: 800 },
  ],
  ...over,
});

describe('entry animation events', () => {
  it('money flows from the credited account to the debited one', () => {
    const e = eventFromEntry(entry({ intent: 'expense' }, 'a:food', 'a:cash'), accounts)!;
    expect(e).toMatchObject({ variant: 'poof', from: 'Cash', to: 'Food', amount: 800, caption: 'Money spent' });
  });

  it('income rains into the account, transfers and loans flow', () => {
    expect(eventFromEntry(entry({ intent: 'income' }, 'a:cash', 'a:salary'), accounts)!.variant).toBe('rain');
    expect(eventFromEntry(entry({ intent: 'transfer' }, 'a:house', 'a:cash'), accounts)!.variant).toBe('flow');
  });

  it('a reversal flows back and says so', () => {
    const e = eventFromEntry(entry({ kind: 'reversal', reverses: 'txn:1' }, 'a:cash', 'a:food'), accounts)!;
    expect(e).toMatchObject({ variant: 'flow', from: 'Food', to: 'Cash', caption: 'Reversed' });
  });

  it('a revaluation rises for a profit and falls for a loss', () => {
    const up = eventFromEntry(entry({ kind: 'revaluation' }, 'a:house', 'a:gain'), accounts)!;
    expect(up).toMatchObject({ variant: 'rise', to: 'House', caption: 'Profit' });
    const down = eventFromEntry(entry({ kind: 'revaluation' }, 'a:loss', 'a:house'), accounts)!;
    expect(down).toMatchObject({ variant: 'fall', from: 'House', caption: 'Loss' });
  });

  it('gives every event its own id so the animation restarts', () => {
    const a = eventFromEntry(entry({ intent: 'expense' }, 'a:food', 'a:cash'), accounts)!;
    const b = eventFromEntry(entry({ intent: 'expense' }, 'a:food', 'a:cash'), accounts)!;
    expect(a.id).not.toBe(b.id);
  });
});
