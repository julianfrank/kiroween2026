import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger/ledger';
import { MemoryKV } from '../store/kv';
import { loadAll, saveSetup } from '../store/repo';
import { createVault } from '../store/vault';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from './setup';

const TODAY = '2026-11-22';

function row(over: Partial<DraftRow>): DraftRow {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'asset',
    category: null,
    name: '',
    amountText: '',
    asOfText: '22/Nov/2026',
    ...over,
  };
}

const house = row({ name: 'House', amountText: '40L', asOfText: '10/May/2000' });
const loan = row({ kind: 'liability', name: 'Home loan', amountText: '10L' });

describe('setup draft', () => {
  it('shows the imbalance and blocks Continue until it is exactly zero', () => {
    const ev = evaluateDraft([house, loan], '', TODAY);
    expect(ev.assets).toBe(4_000_000);
    expect(ev.liabilities).toBe(1_000_000);
    expect(ev.imbalance).toBe(3_000_000);
    expect(ev.canContinue).toBe(false);

    const off = evaluateDraft([house, loan], '29L', TODAY);
    expect(off.imbalance).toBe(100_000);
    expect(off.canContinue).toBe(false);

    const ok = evaluateDraft([house, loan], '30L', TODAY);
    expect(ok.imbalance).toBe(0);
    expect(ok.canContinue).toBe(true);
  });

  it('"use difference" makes the draft balance, including negative equity', () => {
    const ev = evaluateDraft([house, loan], '', TODAY);
    const eq = differenceEquity(ev.assets, ev.liabilities);
    expect(evaluateDraft([house, loan], String(eq), TODAY).canContinue).toBe(true);

    const debtor = [row({ name: 'Cash', amountText: '1L' }), row({ kind: 'liability', name: 'Card', amountText: '3L' })];
    const d = evaluateDraft(debtor, '-2L', TODAY);
    expect(d.equity).toBe(-200_000);
    expect(d.canContinue).toBe(true);
  });

  it('flags bad rows (name, amount, paise, date, future date, reserved, duplicate)', () => {
    const rows = [
      row({ name: '', amountText: '5k' }),
      row({ name: 'Cash', amountText: 'lots' }),
      row({ name: 'Coins', amountText: '150.50' }),
      row({ name: 'Bank', amountText: '1k', asOfText: '01/Jan/2099' }),
      row({ name: 'Wallet', amountText: '1k', asOfText: '2026-13-45' }),
      row({ name: 'Opening Equity', amountText: '1k' }),
      row({ name: 'Gold', amountText: '1k' }),
      row({ name: 'gold', amountText: '1k' }),
    ];
    const ev = evaluateDraft(rows, '', TODAY);
    expect(ev.rowErrors.size).toBe(7);
    expect(ev.canContinue).toBe(false);
    expect(evaluateDraft([], '', TODAY).canContinue).toBe(false); // nothing entered
    expect(evaluateDraft([house], 'abc', TODAY).equityError).not.toBeNull();
    expect(evaluateDraft([house], '5.5', TODAY).equityError).not.toBeNull(); // no paise in equity
  });

  it('accepts DD/MMM/YYYY, DD/MM/YYYY and ISO dates for the as-of date', () => {
    for (const asOfText of ['10/May/2000', '10-may-2000', '10/05/2000', '2000-05-10']) {
      const ev = evaluateDraft([row({ name: 'House', amountText: '1L', asOfText })], '1L', TODAY);
      expect(ev.lines[0].asOfDate).toBe('2000-05-10');
    }
  });

  it('ignores untouched rows', () => {
    const ev = evaluateDraft([row({}), house, loan], '30L', TODAY);
    expect(ev.rowErrors.size).toBe(0);
    expect(ev.lines.length).toBe(2);
  });
});

describe('buildSetup', () => {
  const lines = () =>
    evaluateDraft([house, loan, row({ name: 'Savings', amountText: '2L', category: 'savings' })], '32L', TODAY).lines;

  it('refuses an unbalanced draft', () => {
    expect(() => buildSetup(lines(), 1, TODAY)).toThrow(/not balanced/);
  });

  it('writes dated opening entries, seeds starters, and gives the right net worth', () => {
    const { accounts, ledger } = buildSetup(lines(), 3_200_000, TODAY);
    const names = [...accounts.values()].map((a) => a.name);
    expect(names).toEqual(
      expect.arrayContaining(['Salary', 'Food', 'Rent', 'Transport', 'Utilities', 'Investments', 'Opening Equity', 'Valuation Gain', 'Valuation Loss']),
    );
    expect(names.filter((n) => n === 'Savings').length).toBe(1); // user row replaced the starter
    const dates = [...ledger.entries.values()].map((e) => e.date).sort();
    expect(dates[0]).toBe('2000-05-10');
    const entry = [...ledger.entries.values()].find((e) => e.note.includes('House'))!;
    expect(entry.note).toBe('Opening balance: House, as of 10/May/2000');
    expect(entry.kind).toBe('opening');
    const houseKey = [...accounts.values()].find((a) => a.name === 'House')!.key;
    expect(ledger.balance(houseKey, '1999-12-31')).toBe(0);
    expect(ledger.balance(houseKey, '2000-05-10')).toBe(4_000_000);
    expect(ledger.netWorth()).toBe(3_200_000);
  });
});

describe('persistence', () => {
  it('saves a setup encrypted and loads the same ledger back', async () => {
    const kv = new MemoryKV();
    const vault = await createVault(kv, 'pw', 1000);
    const { accounts, ledger } = buildSetup(evaluateDraft([house, loan], '30L', TODAY).lines, 3_000_000, TODAY);
    await saveSetup(vault, accounts, ledger.entries);

    const stored = [...kv.data.entries()].flat().join('\n');
    expect(stored).not.toContain('House');
    expect(stored).not.toContain('Home loan');

    const loaded = await loadAll(vault);
    expect(loaded.accounts.size).toBe(accounts.size);
    expect(loaded.ledger.entries.size).toBe(ledger.entries.size);
    expect(loaded.ledger).toBeInstanceOf(Ledger);
    expect(loaded.ledger.netWorth()).toBe(ledger.netWorth());
  });
});
