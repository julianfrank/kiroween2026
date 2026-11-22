// Two sample datasets for the password screen. Each is a full set of books with 25 transactions dated
// relative to today (IST), so every tab has something to show: income and spending in Daily Updates,
// transfers and revaluations in Assets, loans in Liabilities, budgets and goals with progress.
// Every entry goes through the same resolver the chat uses, so notes, intents and checks match real use.

import { blankDraft, resolveAny, type EntryDraft } from '../chat/draft';
import type { IntentId } from '../chat/intents';
import { formatDate } from '../dates/dates';
import { addDays } from '../dates/resolve';
import { buildSetup, evaluateDraft, type DraftRow } from '../setup/setup';
import type { LoadedData } from '../store/repo';

export type SampleKind = 'negative' | 'positive';

export const SAMPLE_LABELS: Record<SampleKind, string> = {
  negative: 'Sample that ends below zero',
  positive: 'Sample that ends above zero',
};

interface Opening {
  name: string;
  amount: string;
  kind?: 'liability';
  category?: 'savings' | 'investment';
  /** Days before today the balance started. */
  since: number;
}

/** [days ago, intent, amount, from, to, what the user might have typed] */
type Step = [number, IntentId, string, string, string, string];

interface Plan {
  opening: Opening[];
  steps: Step[];
  budgets: Array<[string, string]>;
  goals: Array<{ name: string; amount: string; account: string; months: number | null }>;
}

const PLANS: Record<SampleKind, Plan> = {
  positive: {
    opening: [
      { name: 'Cash', amount: '25,000', since: 45 },
      { name: 'HDFC Bank', amount: '3.5L', since: 45 },
      { name: 'Savings', amount: '1.5L', category: 'savings', since: 45 },
      { name: 'Investments', amount: '2L', category: 'investment', since: 45 },
      { name: 'Car', amount: '4L', since: 700 },
      { name: 'Credit Card', amount: '40,000', kind: 'liability', since: 45 },
      { name: 'Car Loan - HDFC', amount: '2.5L', kind: 'liability', since: 700 },
    ],
    steps: [
      [30, 'income', '85000', 'Salary', 'HDFC Bank', 'Salary of 85k credited to HDFC Bank'],
      [29, 'expense', '22000', 'HDFC Bank', 'Rent', 'Paid rent of 22,000 from HDFC Bank'],
      [27, 'expense', '3200', 'HDFC Bank', 'Utilities', 'Electricity bill 3200 from HDFC Bank'],
      [25, 'expense', '2400', 'Cash', 'Food', 'Groceries 2400 in cash'],
      [24, 'transfer', '10000', 'HDFC Bank', 'Cash', 'Withdrew 10k cash from HDFC Bank'],
      [22, 'transfer', '15000', 'HDFC Bank', 'Savings', 'Moved 15k to Savings'],
      [20, 'transfer', '20000', 'HDFC Bank', 'Investments', 'Invested 20k from HDFC Bank'],
      [18, 'repay', '15000', 'HDFC Bank', 'Credit Card', 'Paid 15k towards the Credit Card'],
      [15, 'repay', '12000', 'HDFC Bank', 'Car Loan - HDFC', 'Car loan EMI 12,000'],
      [14, 'expense', '1800', 'Cash', 'Transport', 'Petrol 1800 in cash'],
      [12, 'income', '12000', 'Other Income', 'HDFC Bank', 'Freelance payment of 12k received'],
      [10, 'expense', '3100', 'Cash', 'Food', 'Dinner out 3100'],
      [8, 'revalue', '235000', '', 'Investments', 'Investments are now worth 2.35L'],
      [6, 'expense', '650', 'Cash', 'Food', 'Snacks 650'],
      [5, 'borrow', '5000', 'Loan - Tom', 'Cash', 'Borrowed 5000 from Tom'],
      [4, 'expense', '900', 'Cash', 'Transport', 'Auto fares 900'],
      [3, 'repay', '5000', 'HDFC Bank', 'Loan - Tom', 'Paid Tom back 5000'],
      [2, 'transfer', '10000', 'HDFC Bank', 'Savings', 'Moved another 10k to Savings'],
      [2, 'expense', '1499', 'HDFC Bank', 'Utilities', 'Internet bill 1499'],
      [1, 'expense', '2500', 'Cash', 'Other Expense', 'Birthday gift 2500'],
      [1, 'income', '3000', 'Other Income', 'Cash', 'Cashback of 3000'],
      [0, 'expense', '1200', 'Cash', 'Food', 'Groceries 1200 today'],
      [0, 'expense', '350', 'Cash', 'Transport', 'Metro card top-up 350'],
      [0, 'revalue', '380000', '', 'Car', 'My car is now worth 3.8L'],
      [0, 'transfer', '5000', 'HDFC Bank', 'Savings', 'Saved 5000 more'],
    ],
    budgets: [['Food', '8000'], ['Transport', '3000'], ['Utilities', '5000']],
    goals: [
      { name: 'Emergency fund', amount: '3L', account: 'Savings', months: 12 },
      { name: 'Retirement', amount: '10L', account: 'Investments', months: null },
    ],
  },
  negative: {
    opening: [
      { name: 'Cash', amount: '8,000', since: 45 },
      { name: 'HDFC Bank', amount: '45,000', since: 45 },
      { name: 'Savings', amount: '20,000', category: 'savings', since: 45 },
      { name: 'Investments', amount: '30,000', category: 'investment', since: 45 },
      { name: 'Car', amount: '3.5L', since: 900 },
      { name: 'Credit Card', amount: '90,000', kind: 'liability', since: 45 },
      { name: 'Personal Loan - Dubakur Bank', amount: '3L', kind: 'liability', since: 300 },
    ],
    steps: [
      [30, 'income', '45000', 'Salary', 'HDFC Bank', 'Salary of 45k credited'],
      [29, 'expense', '18000', 'HDFC Bank', 'Rent', 'Rent 18,000 from HDFC Bank'],
      [27, 'expense', '4100', 'HDFC Bank', 'Utilities', 'Electricity and water 4100'],
      [25, 'expense', '6500', 'Cash', 'Food', 'Groceries 6500'],
      [24, 'transfer', '12000', 'HDFC Bank', 'Cash', 'Withdrew 12k cash'],
      [22, 'expense', '25000', 'HDFC Bank', 'Other Expense', 'New phone 25,000'],
      [20, 'borrow', '40000', 'Loan - Tom', 'HDFC Bank', 'Borrowed 40k from Tom'],
      [18, 'expense', '60000', 'HDFC Bank', 'Other Expense', 'Hospital bill 60,000'],
      [15, 'repay', '5000', 'HDFC Bank', 'Credit Card', 'Paid 5000 on the Credit Card'],
      [14, 'expense', '4200', 'Cash', 'Food', 'Eating out 4200'],
      [12, 'expense', '2800', 'Cash', 'Transport', 'Cabs 2800'],
      [10, 'revalue', '22000', '', 'Investments', 'Investments fell to 22,000'],
      [9, 'transfer', '15000', 'Savings', 'HDFC Bank', 'Took 15k out of Savings'],
      [8, 'expense', '3900', 'Cash', 'Food', 'Groceries 3900'],
      [7, 'borrow', '10000', 'Credit Card', 'Cash', 'Cash advance of 10k on the Credit Card'],
      [6, 'expense', '2300', 'HDFC Bank', 'Utilities', 'Phone and internet 2300'],
      [5, 'expense', '1600', 'Cash', 'Transport', 'Petrol 1600'],
      [4, 'revalue', '290000', '', 'Car', 'Car value dropped to 2.9L'],
      [3, 'expense', '2700', 'Cash', 'Food', 'Takeaway 2700'],
      [2, 'expense', '9000', 'HDFC Bank', 'Other Expense', 'Bike repairs 9000'],
      [2, 'repay', '5000', 'HDFC Bank', 'Loan - Tom', 'Paid Tom back 5000'],
      [1, 'income', '4000', 'Other Income', 'Cash', 'Sold old books for 4000'],
      [0, 'expense', '1800', 'Cash', 'Food', 'Groceries 1800 today'],
      [0, 'expense', '650', 'Cash', 'Transport', 'Auto 650'],
      [0, 'expense', '3500', 'HDFC Bank', 'Other Expense', 'Late fee 3500'],
    ],
    budgets: [['Food', '6000'], ['Transport', '2500']],
    goals: [{ name: 'Emergency fund', amount: '1L', account: 'Savings', months: 6 }],
  },
};

function plus(months: number, today: string): string {
  return addDays(today, Math.round(months * 30.4375));
}

/** Build one sample dataset as of `today` (an IST ISO date). Throws if any entry fails the app's checks. */
export function buildSample(kind: SampleKind, today: string): LoadedData {
  const plan = PLANS[kind];
  const rows: DraftRow[] = plan.opening.map((o, i) => ({
    id: `sample-${i}`,
    kind: o.kind ?? 'asset',
    category: o.category ?? null,
    name: o.name,
    amountText: o.amount,
    asOfText: formatDate(addDays(today, -o.since)),
  }));
  const first = evaluateDraft(rows, '', today);
  const ev = evaluateDraft(rows, String(first.assets - first.liabilities), today);
  if (!ev.canContinue) throw new Error(`Sample opening balances are invalid: ${[...ev.rowErrors.values()].join(' ')}`);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, today);
  const data: LoadedData = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const ctx = () => ({ accounts: data.accounts, budgets: data.budgets, goals: data.goals, today, balanceOf: (k: string) => data.ledger.balance(k) });

  const apply = (draft: EntryDraft) => {
    const r = resolveAny(draft, ctx());
    if (!r.ok) throw new Error(`Sample step "${draft.userText}" failed: ${r.problems.map((p) => p.message).join(' ')}`);
    for (const a of r.newAccounts) data.accounts.set(a.key, a);
    if (r.kind === 'entry') data.ledger.append(r.entry);
    else if (r.kind === 'budget') data.budgets.set(r.key, r.budget);
    else data.goals.set(r.key, r.goal);
  };

  for (const [daysAgo, intent, amount, from, to, said] of plan.steps) {
    apply({ ...blankDraft(said), intent, amountText: amount, dateText: addDays(today, -daysAgo), fromName: from, toName: to, source: 'manual-form' });
  }
  for (const [category, limit] of plan.budgets) {
    apply({ ...blankDraft(`Set a monthly budget of ${limit} for ${category}`), intent: 'set-budget', amountText: limit, toName: category });
  }
  for (const g of plan.goals) {
    apply({
      ...blankDraft(`Save ${g.amount} for ${g.name}`),
      intent: 'set-goal',
      amountText: g.amount,
      fromName: g.name,
      toName: g.account,
      dateText: g.months === null ? '' : plus(g.months, today),
    });
  }
  return data;
}
