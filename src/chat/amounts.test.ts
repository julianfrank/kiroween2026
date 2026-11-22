import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger/ledger';
import type { Account } from '../ledger/types';
import { evaluateDraft, buildSetup, type DraftRow } from '../setup/setup';
import { blankDraft, resolveDraft } from './draft';
import { chooseAmountText, extractAmounts } from './amounts';
import { proposeEntry } from './proposal';

const TODAY = '2026-11-22';

describe('the app reads amounts, not the model', () => {
  it('extracts money from a message and ignores dates and counts', () => {
    expect(extractAmounts("I've paid back 30L by selling Delhi house for 30L")).toEqual([3_000_000]);
    expect(extractAmounts("I've taken a loan of Rs.5000 from Tom")).toEqual([5000]);
    expect(extractAmounts('paid 800 for groceries on 3 Nov')).toEqual([800]);
    expect(extractAmounts('paid 800 for rent on 22/Nov/2026 and 3 days ago')).toEqual([800]);
    expect(extractAmounts('salary ₹1,20,000 and bonus 1.5 cr')).toEqual([120000, 15_000_000]);
    expect(extractAmounts('take 2 bags')).toEqual([]);
  });

  it('uses the only amount in the message even when the model converted it wrongly', () => {
    expect(chooseAmountText('paid back 30L', '30000000')).toBe('3000000'); // model said 3 crore
    expect(chooseAmountText('paid back 30L', '30L')).toBe('3000000');
  });

  it('with several amounts, keeps the model only if it picked one of them, else asks', () => {
    expect(chooseAmountText('paid 500 of the 2000 owed', '500')).toBe('500');
    expect(chooseAmountText('paid 500 of the 2000 owed', '7777')).toBe('');
  });

  it('never takes an amount from the model when the message has none (it once invented 100 crore)', () => {
    expect(chooseAmountText('paid the rent', '')).toBe('');
    expect(chooseAmountText('Dubakur Bank - Home Loan is a liability and not an asset', '100cr')).toBe('');
    expect(chooseAmountText('paid five thousand', '5000')).toBe(''); // words are not read: the user types it on the card
    expect(chooseAmountText('the flat is worthless', '0')).toBe('0');
    expect(chooseAmountText('pay the rent', '0')).toBe('');
  });

  it('a single small bare number is still an amount, several are not guessed', () => {
    expect(chooseAmountText('paid 50 for tea', '5')).toBe('50');
    expect(chooseAmountText('paid 3 days ago 50 for tea', '')).toBe('50');
    expect(chooseAmountText('bought 2 bags and 3 pens', '')).toBe('');
    expect(chooseAmountText('paid in 2026 for rent', '')).toBe('');
  });
});

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2026', ...over };
}

function setup() {
  // Delhi house 30 crore, Bombay 20 crore, loan 1 crore... scaled so the numbers are easy to check.
  const rows = [
    row({ name: 'Delhi', amountText: '30cr' }),
    row({ name: 'Bombay', amountText: '20cr' }),
    row({ kind: 'liability', name: 'Personal Loan - Dubakur Bank', amountText: '1cr' }),
  ];
  const ev = evaluateDraft(rows, '49cr', TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const id = (name: string) => [...accounts.values()].find((a: Account) => a.name === name)!.key;
  return { accounts, ledger, id };
}

function post(ledger: Ledger, accounts: ReadonlyMap<string, Account>, text: string, amountText: string) {
  const r = resolveDraft(
    { ...blankDraft(text), intent: 'repay', amountText, fromName: 'Delhi', toName: 'Personal Loan', source: 'ai-confirmed' },
    { accounts, today: TODAY, balanceOf: (k) => ledger.balance(k) },
  );
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' '));
  ledger.append(r.entry);
  return r;
}

describe('repaying a loan', () => {
  it('reduces the liability by exactly the amount paid, and the paying asset by the same amount', () => {
    const { accounts, ledger, id } = setup();
    expect(ledger.balance(id('Personal Loan - Dubakur Bank'))).toBe(10_000_000);
    expect(ledger.balance(id('Delhi'))).toBe(300_000_000);
    const netWorthBefore = ledger.netWorth();

    post(ledger, accounts, 'paid back 30L', '30L');

    expect(ledger.balance(id('Personal Loan - Dubakur Bank'))).toBe(10_000_000 - 3_000_000);
    expect(ledger.balance(id('Delhi'))).toBe(300_000_000 - 3_000_000);
    expect(ledger.netWorth()).toBe(netWorthBefore); // paying a debt from an asset does not change net worth
  });

  it('books Debit on the loan and Credit on the paying asset', () => {
    const { accounts, ledger } = setup();
    const r = post(ledger, accounts, 'paid back 30L', '30L');
    expect(r.lines.map((l) => [l.side, l.accountName, l.amount])).toEqual([
      ['Debit', 'Personal Loan - Dubakur Bank', 3_000_000],
      ['Credit', 'Delhi', 3_000_000],
    ]);
  });

  it('borrowing is the opposite: the liability and the receiving asset both go up', () => {
    const { accounts, ledger, id } = setup();
    const r = resolveDraft(
      { ...blankDraft('from bank'), intent: 'borrow', amountText: '5L', fromName: 'Personal Loan', toName: 'Bombay', source: 'ai-confirmed' },
      { accounts, today: TODAY, balanceOf: (k) => ledger.balance(k) },
    );
    if (!r.ok) throw new Error('should resolve');
    ledger.append(r.entry);
    expect(ledger.balance(id('Personal Loan - Dubakur Bank'))).toBe(10_000_000 + 500_000);
    expect(ledger.balance(id('Bombay'))).toBe(200_000_000 + 500_000);
  });

  it('end to end: a model that wrongly answers 3 crore still produces a 30 lakh repayment', async () => {
    const { accounts, ledger, id } = setup();
    const host = {
      prompt: async () =>
        JSON.stringify({ intent: 'repay', amount: '30000000', date: '', fromAccount: 'Delhi', toAccount: 'Personal Loan' }),
    };
    const out = await proposeEntry(host, {
      tab: 'liabilities',
      message: "I've paid back 30L by selling Delhi house for 30L",
      today: TODAY,
      accounts,
      balanceOf: (k) => ledger.balance(k),
    });
    expect(out.type).toBe('confirm');
    if (out.type !== 'confirm') return;
    expect(out.draft.amountText).toBe('3000000');
    if (out.resolved.kind !== 'entry') throw new Error('expected an entry');
    expect(out.resolved.lines.map((l) => l.amount)).toEqual([3_000_000, 3_000_000]);
    ledger.append(out.resolved.entry);
    expect(ledger.balance(id('Personal Loan - Dubakur Bank'))).toBe(7_000_000);
  });
});
