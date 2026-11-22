import { describe, expect, it } from 'vitest';
import { formatRupees, parseRupees } from '../money/money';
import { isSetupBalanced, setupImbalance, validateEntry } from '../rules/rules';
import { Ledger, LedgerError } from './ledger';
import type { Account, Entry } from './types';

const accounts = new Map<string, Account>(
  [
    ['acct:cash', 'Cash', 'asset'],
    ['acct:tom', 'Loan - Tom', 'liability'],
    ['acct:food', 'Food', 'expense'],
    ['acct:salary', 'Salary', 'income'],
  ].map(([key, name, kind]) => [
    key,
    { key, name, kind: kind as Account['kind'], asOfDate: '2026-01-01' },
  ]),
);

function entry(over: Partial<Entry> = {}): Entry {
  return {
    date: '2026-11-22',
    note: 'Borrowed Rs.5000 from Tom; cash received',
    kind: 'normal',
    reverses: null,
    correctionOf: null,
    source: 'ai-confirmed',
    lines: [
      { account: 'acct:cash', debitRupees: 5000, creditRupees: 0 },
      { account: 'acct:tom', debitRupees: 0, creditRupees: 5000 },
    ],
    ...over,
  };
}

describe('money', () => {
  it('parses common amount formats into Rupees', () => {
    expect(parseRupees('Rs.5000')).toBe(5000);
    expect(parseRupees('₹ 5,000')).toBe(5000);
    expect(parseRupees('1,20,000')).toBe(120000);
    expect(parseRupees('5k')).toBe(5000);
    expect(parseRupees('1.2L')).toBe(120000);
    expect(parseRupees('1.25k')).toBe(1250);
    expect(parseRupees('1.5 cr')).toBe(15000000);
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('-5')).toBeNull();
    expect(parseRupees('0')).toBeNull();
  });

  it('rejects paise: plain decimals and fractions of a rupee', () => {
    expect(parseRupees('5000.50')).toBeNull();
    expect(parseRupees('1,20,000.50')).toBeNull();
    expect(parseRupees('0.001k')).toBeNull();
    expect(parseRupees('1.234L')).toBeNull(); // more than two decimals is not a number we accept
  });

  it('formats whole rupees with lakh/crore grouping and no decimals', () => {
    expect(formatRupees(120000)).toBe('₹1,20,000');
    expect(formatRupees(15000000)).toBe('₹1,50,00,000');
    expect(formatRupees(-1500)).toBe('-₹1,500');
    expect(formatRupees(0)).toBe('₹0');
  });
});

describe('rules', () => {
  it('accepts a balanced entry', () => {
    expect(validateEntry(entry(), accounts)).toEqual([]);
  });

  it('rejects unbalanced, unknown account, bad date, empty note, one line', () => {
    const bad = entry({
      date: '2026-02-30',
      note: ' ',
      lines: [{ account: 'acct:nope', debitRupees: 100, creditRupees: 0 }],
    });
    const problems = validateEntry(bad, accounts).join('|');
    expect(problems).toContain('Invalid date');
    expect(problems).toContain('note');
    expect(problems).toContain('at least two lines');
    expect(problems).toContain('Unknown account');
    expect(problems).toContain('Debits (100) must equal credits (0)');
  });

  it('rejects a line with both debit and credit, and fractional rupees', () => {
    const e = entry({
      lines: [
        { account: 'acct:cash', debitRupees: 100, creditRupees: 100 },
        { account: 'acct:tom', debitRupees: 0.5, creditRupees: 0 },
      ],
    });
    expect(validateEntry(e, accounts).length).toBeGreaterThan(0);
  });

  it('setup balances only when Assets = Liabilities + Opening Equity', () => {
    const t = { assets: 50000, liabilities: 10000, equity: 30000 };
    expect(setupImbalance(t)).toBe(10000);
    expect(isSetupBalanced(t)).toBe(false);
    expect(isSetupBalanced({ ...t, equity: 40000 })).toBe(true);
  });
});

describe('ledger', () => {
  it('appends with sequential keys and computes balances and net worth', () => {
    const l = new Ledger(accounts);
    expect(l.append(entry())).toBe('txn:2026-11-22:0001');
    expect(l.append(entry({ note: 'second' }))).toBe('txn:2026-11-22:0002');
    expect(l.balance('acct:cash')).toBe(10000);
    expect(l.balance('acct:tom')).toBe(10000);
    expect(l.netWorth()).toBe(0);
    expect(l.balance('acct:cash', '2026-11-21')).toBe(0);
  });

  it('refuses an unbalanced entry and leaves the ledger unchanged', () => {
    const l = new Ledger(accounts);
    const bad = entry({ lines: [entry().lines[0], { account: 'acct:tom', debitRupees: 0, creditRupees: 1 }] });
    expect(() => l.append(bad)).toThrow(LedgerError);
    expect(l.entries.size).toBe(0);
  });

  it('has no way to edit or delete entries', () => {
    const l = new Ledger(accounts) as unknown as Record<string, unknown>;
    for (const name of ['update', 'edit', 'delete', 'remove']) expect(l[name]).toBeUndefined();
  });

  it('reversal links to its original, cancels it, and carries a clear note', () => {
    const l = new Ledger(accounts);
    const key = l.append(entry());
    const rev = l.reverse(key, '2026-11-23', 'amount was wrong');
    const e = l.entries.get(rev)!;
    expect(e.kind).toBe('reversal');
    expect(e.reverses).toBe(key);
    expect(e.note).toContain(key);
    expect(e.note).toContain('amount was wrong');
    expect(l.balance('acct:cash')).toBe(0);
    expect(l.balance('acct:tom')).toBe(0);
    expect(l.isReversed(key)).toBe(true);
  });

  it('refuses to reverse twice, or reverse a reversal', () => {
    const l = new Ledger(accounts);
    const key = l.append(entry());
    const rev = l.reverse(key, '2026-11-23', 'oops');
    expect(() => l.reverse(key, '2026-11-24', 'again')).toThrow(/already reversed/);
    expect(() => l.reverse(rev, '2026-11-24', 'undo undo')).toThrow(/reversal/);
  });

  it('correction posts a reversal plus a corrected entry, both linked', () => {
    const l = new Ledger(accounts);
    const key = l.append(entry());
    const fixed = [
      { account: 'acct:cash', debitRupees: 6000, creditRupees: 0 },
      { account: 'acct:tom', debitRupees: 0, creditRupees: 6000 },
    ];
    const { reversal, correction } = l.correct(key, '2026-11-23', 'typed 5000, was 6000', fixed, 'Borrowed Rs.6000 from Tom');
    expect(l.entries.get(reversal)!.reverses).toBe(key);
    expect(l.entries.get(correction)!.correctionOf).toBe(key);
    expect(l.balance('acct:cash')).toBe(6000);
    expect(l.balance('acct:tom')).toBe(6000);
  });

  it('an invalid correction leaves the books as they were', () => {
    const l = new Ledger(accounts);
    const key = l.append(entry());
    const bad = [{ account: 'acct:cash', debitRupees: 1, creditRupees: 0 }];
    expect(() => l.correct(key, '2026-11-23', 'x', bad, 'bad')).toThrow(LedgerError);
    expect(l.isReversed(key)).toBe(false);
    expect(l.entries.size).toBe(1);
  });

  it('supports the example flow: salary then groceries keeps net worth consistent', () => {
    const l = new Ledger(accounts);
    l.append(entry({
      note: 'Salary received', kind: 'normal',
      lines: [
        { account: 'acct:cash', debitRupees: 50000, creditRupees: 0 },
        { account: 'acct:salary', debitRupees: 0, creditRupees: 50000 },
      ],
    }));
    l.append(entry({
      note: 'Groceries', lines: [
        { account: 'acct:food', debitRupees: 800, creditRupees: 0 },
        { account: 'acct:cash', debitRupees: 0, creditRupees: 800 },
      ],
    }));
    expect(l.balance('acct:cash')).toBe(49200);
    expect(l.balance('acct:food')).toBe(800);
    expect(l.netWorth()).toBe(49200);
  });
});
