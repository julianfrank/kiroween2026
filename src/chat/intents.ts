import type { AccountKind } from '../ledger/types';

export type ChatTabId = 'assets' | 'liabilities' | 'goals' | 'budgets' | 'daily';
export const CHAT_TABS: ChatTabId[] = ['daily', 'assets', 'liabilities', 'goals', 'budgets'];
export const TAB_LABELS: Record<ChatTabId, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  goals: 'Goals',
  budgets: 'Budgets',
  daily: 'Daily Updates',
};

export type IntentId =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'borrow'
  | 'repay'
  | 'revalue'
  | 'set-budget'
  | 'set-goal';

/** Money always flows from the credit account to the debit account. */
export interface IntentDef {
  id: IntentId;
  label: string;
  /** One line for the model prompt. */
  hint: string;
  /** "to": the account that is debited (for targets: the account the target attaches to). */
  toKind: AccountKind;
  toLabel: string;
  /** "from": the account that is credited. Null when the intent has no second account. */
  fromKind: AccountKind | null;
  fromLabel: string;
  /** The tab that normally handles this intent. */
  home: ChatTabId;
  /** Budgets and Goals set a target and do not touch the ledger. */
  target?: boolean;
  amountLabel?: string;
  /** When set, the "from" field is a free-text name (the goal name), not an account. */
  nameLabel?: string;
  dateLabel?: string;
}

export const INTENTS: Record<IntentId, IntentDef> = {
  income: {
    id: 'income',
    label: 'Income received',
    hint: 'money received, such as salary or a gift. fromAccount = the income source, toAccount = the account that received the money.',
    toKind: 'asset', toLabel: 'Received into',
    fromKind: 'income', fromLabel: 'Income source',
    home: 'daily',
  },
  expense: {
    id: 'expense',
    label: 'Expense paid',
    hint: 'money spent. fromAccount = the account it was paid from, toAccount = the spending category such as Food or Rent.',
    toKind: 'expense', toLabel: 'Expense category',
    fromKind: 'asset', fromLabel: 'Paid from',
    home: 'daily',
  },
  transfer: {
    id: 'transfer',
    label: 'Transfer between accounts',
    hint: 'money moved between your own accounts, including savings, investments and buying an asset with cash. fromAccount = where it left, toAccount = where it went.',
    toKind: 'asset', toLabel: 'Move to',
    fromKind: 'asset', fromLabel: 'Move from',
    home: 'daily',
  },
  borrow: {
    id: 'borrow',
    label: 'Loan taken',
    hint: 'the user borrowed money. fromAccount = the lender as "Loan - Name", toAccount = the account that received the money.',
    toKind: 'asset', toLabel: 'Money received into',
    fromKind: 'liability', fromLabel: 'Borrowed from (loan)',
    home: 'liabilities',
  },
  repay: {
    id: 'repay',
    label: 'Loan repaid',
    hint: 'the user repaid a loan. fromAccount = the account it was paid from, toAccount = the loan as "Loan - Name".',
    toKind: 'liability', toLabel: 'Loan repaid',
    fromKind: 'asset', fromLabel: 'Paid from',
    home: 'liabilities',
  },
  revalue: {
    id: 'revalue',
    label: 'New value of an asset',
    hint: 'an asset is now worth a different amount. amount = the NEW total value, toAccount = the asset, fromAccount = "".',
    toKind: 'asset', toLabel: 'Asset',
    fromKind: null, fromLabel: '',
    amountLabel: 'New value (₹)',
    home: 'assets',
  },
  'set-budget': {
    id: 'set-budget',
    label: 'Set a monthly budget',
    hint: 'the user sets or changes a monthly spending limit. amount = the limit, toAccount = the spending category (for example Food), fromAccount = "".',
    toKind: 'expense', toLabel: 'Spending category',
    fromKind: null, fromLabel: '',
    amountLabel: 'Monthly limit (₹)',
    home: 'budgets',
    target: true,
  },
  'set-goal': {
    id: 'set-goal',
    label: 'Set a goal',
    hint: 'the user sets a savings or investment goal. fromAccount = the goal name, amount = the target amount, toAccount = the savings or investment account that holds the money, date = the target date words if any.',
    toKind: 'asset', toLabel: 'Saved in (account)',
    fromKind: null, fromLabel: '',
    nameLabel: 'Goal name',
    amountLabel: 'Target amount (₹)',
    dateLabel: 'Target date (optional)',
    home: 'goals',
    target: true,
  },
};

export const ALL_INTENTS = Object.keys(INTENTS) as IntentId[];

export const TAB_SCOPES: Record<ChatTabId, IntentId[]> = {
  daily: ['income', 'expense', 'transfer'],
  assets: ['transfer', 'revalue'],
  liabilities: ['borrow', 'repay'],
  goals: ['set-goal', 'transfer'],
  budgets: ['set-budget'],
};
