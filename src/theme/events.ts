import type { Account, Entry } from '../ledger/types';
import type { Rupees } from '../money/money';

/** What the entry animation should show. `flow` carries coins from one account to another. */
export interface EntryEvent {
  id: number;
  variant: 'flow' | 'rain' | 'poof' | 'rise' | 'fall';
  from: string;
  to: string;
  amount: Rupees;
  /** Short caption, for example "Loan repaid". */
  caption: string;
}

let counter = 1;

const CAPTION: Record<string, string> = {
  income: 'Money in',
  expense: 'Money spent',
  transfer: 'Moved',
  borrow: 'Loan taken',
  repay: 'Loan repaid',
};

/** Describe a saved entry for the animation layer. Money moves from the credited to the debited account. */
export function eventFromEntry(entry: Entry, accounts: ReadonlyMap<string, Account>): EntryEvent | null {
  const debit = entry.lines.find((l) => l.debitRupees > 0);
  const credit = entry.lines.find((l) => l.creditRupees > 0);
  if (!debit || !credit) return null;
  const name = (key: string) => accounts.get(key)?.name ?? 'Account';
  const from = accounts.get(credit.account);
  const amount = debit.debitRupees;
  const id = counter++;

  if (entry.kind === 'revaluation') {
    const gain = from?.system === 'valuation-gain';
    return {
      id,
      variant: gain ? 'rise' : 'fall',
      from: gain ? 'Valuation Gain' : name(credit.account),
      to: gain ? name(debit.account) : 'Valuation Loss',
      amount,
      caption: gain ? 'Profit' : 'Loss',
    };
  }
  const caption =
    entry.kind === 'reversal' ? 'Reversed' : entry.kind === 'correction' ? 'Corrected' : (entry.intent && CAPTION[entry.intent]) || 'Entry';
  const variant = entry.kind === 'reversal' ? 'flow' : entry.intent === 'income' ? 'rain' : entry.intent === 'expense' ? 'poof' : 'flow';
  return { id, variant, from: name(credit.account), to: name(debit.account), amount, caption };
}
