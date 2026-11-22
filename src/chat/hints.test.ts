import { describe, expect, it } from 'vitest';
import { GOLDEN, goldenWorld, scoreCase } from '../golden/golden';
import { buildSetup, evaluateDraft } from '../setup/setup';
import { accountInMessage, categoryFromText, newLenderFromMessage, refineNames } from './hints';
import { proposeEntry, type PromptHost } from './proposal';

const { accounts, ledger } = goldenWorld();

/** The exact replies the real model (Chrome 157) gave for the five golden sentences it failed. */
const REAL_FAILURES: Array<[string, object]> = [
  ['Spent 1200 on petrol from cash', { intent: 'expense', amount: '1200', date: '', fromAccount: 'Cash', toAccount: 'Petrol' }],
  ['Freelance payment of 1.2L received in HDFC Bank on 15 Nov', { intent: 'income', amount: '1.2L', date: '15 Nov', fromAccount: 'Other Income', toAccount: '' }],
  // Run 2: the model put the bank on the wrong side and left the receiving account blank.
  ['Freelance payment of 1.2L received in HDFC Bank on 15 Nov', { intent: 'income', amount: '1.2L', date: '15 Nov', fromAccount: 'HDFC Bank', toAccount: '' }],
  ['Dinner at a restaurant 1,800 from cash on 20/Nov/2026', { intent: 'expense', amount: '1,800', date: '20/Nov/2026', fromAccount: 'Cash', toAccount: 'Other Expense' }],
  ["I've taken a Loan of Rs.5000 from Tom", { intent: 'borrow', amount: 'Rs.5000', date: '', fromAccount: '', toAccount: 'Cash' }],
  ['Borrowed 20k from Tom into HDFC Bank yesterday', { intent: 'borrow', amount: '20k', date: 'yesterday', fromAccount: '', toAccount: 'HDFC Bank' }],
];

describe('the golden sentences the real model failed (runs 1 and 2)', () => {
  it.each(REAL_FAILURES)('"%s" now passes with the same model reply %o', async (message, reply) => {
    const c = GOLDEN.find((g) => g.message === message)!;
    const host: PromptHost = { prompt: async () => JSON.stringify(reply) };
    const out = await proposeEntry(host, { tab: c.tab, message, today: '2026-11-22', accounts, balanceOf: (k) => ledger.balance(k) });
    const result = scoreCase(c, out, accounts);
    expect(Object.entries(result.fields).filter(([, f]) => !f!.ok)).toEqual([]);
  });
});

describe('repairing names from the message', () => {
  it('maps everyday words to the existing spending categories', () => {
    expect(categoryFromText('Spent 1200 on petrol', accounts)).toBe('Transport');
    expect(categoryFromText('Dinner at a restaurant', accounts)).toBe('Food');
    expect(categoryFromText('Internet bill 999', accounts)).toBe('Utilities');
    expect(categoryFromText('Paid the rent', accounts)).toBe('Rent');
    expect(categoryFromText('Bought a lamp', accounts)).toBeNull();
  });

  it('finds the account the message names, whole words only, and a lender by name', () => {
    expect(accountInMessage('received in HDFC Bank on 15 Nov', 'asset', accounts)).toBe('HDFC Bank');
    expect(accountInMessage('borrowed from Tom', 'liability', accounts)).toBe('Loan - Tom');
    expect(accountInMessage('paid the card bill', 'liability', accounts)).toBe('Card');
    expect(accountInMessage('paid the bank', 'liability', accounts)).toBeNull(); // "bank" alone names nothing
    const withCar = buildSetup(evaluateDraft([{ id: 'c', kind: 'asset', category: null, name: 'Car', amountText: '1L', asOfText: '01/Jan/2026' }], '1L', '2026-11-22').lines, 100000, '2026-11-22');
    expect(accountInMessage('paid the card bill', 'asset', withCar.accounts)).toBeNull(); // "Car" is not "card"
    expect(newLenderFromMessage('Borrowed 5000 from Meera', accounts)).toBe('Loan - Meera');
    expect(newLenderFromMessage('Borrowed 5000 from Cash', accounts)).toBeNull();
  });

  it('only repairs blank, invented or catch-all names; a real choice is kept', () => {
    expect(refineNames('expense', 'Cash', 'Rent', 'Spent on petrol and rent', accounts)).toEqual({ fromName: 'Cash', toName: 'Rent' });
    expect(refineNames('expense', 'Cash', 'Other Expense', 'Bought a lamp', accounts)).toEqual({ fromName: 'Cash', toName: 'Other Expense' });
    expect(refineNames('transfer', 'HDFC Bank', '', 'Moved 5000 from HDFC Bank to Savings', accounts)).toEqual({ fromName: 'HDFC Bank', toName: 'Savings' });
    expect(refineNames('borrow', '', 'Cash', 'Borrowed 5000 from Meera', accounts)).toEqual({ fromName: 'Loan - Meera', toName: 'Cash' });
    expect(refineNames('set-goal', 'Trip', 'Savings', 'Save 50k for a trip', accounts)).toEqual({ fromName: 'Trip', toName: 'Savings' });
  });

  it('moves an account given on the wrong side, but never moves a correct one', () => {
    expect(refineNames('income', 'HDFC Bank', '', 'Freelance payment received in HDFC Bank', accounts)).toEqual({ fromName: '', toName: 'HDFC Bank' });
    expect(refineNames('expense', '', 'Cash', 'Paid 500 in cash for a lamp', accounts)).toEqual({ fromName: 'Cash', toName: '' });
    expect(refineNames('repay', '', 'HDFC Bank', 'Repaid Tom from HDFC Bank', accounts)).toEqual({ fromName: 'HDFC Bank', toName: 'Loan - Tom' });
    // A transfer's two sides are the same kind, so nothing is moved.
    expect(refineNames('transfer', 'Cash', '', 'Moved cash', accounts)).toEqual({ fromName: 'Cash', toName: '' });
    expect(refineNames('income', 'Salary', 'HDFC Bank', 'Salary credited to HDFC Bank', accounts)).toEqual({ fromName: 'Salary', toName: 'HDFC Bank' });
  });
});
