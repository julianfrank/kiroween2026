# Scary Money Manager

A private, single-file personal money manager. The user describes money events in plain text, and an on-device AI turns them into balanced, encrypted ledger entries.

## Language

### Accounts and balances

**Account**:
A named bucket of value in one of five kinds: Asset, Liability, Equity, Income or Expense.
_Avoid_: Category, wallet, ledger head

**Asset**:
An Account holding something the user owns (cash, bank, shares, a house).
_Avoid_: Holding

**Liability**:
An Account recording money the user owes (a loan from Tom, a credit card).
_Avoid_: Debt

**Opening Equity**:
The starting net worth the user declares during Setup so that Assets equal Liabilities plus Opening Equity.
_Avoid_: Capital, plug

**Imbalance**:
The amount by which Assets differ from Liabilities plus Opening Equity during Setup. Zero means balanced.
_Avoid_: Difference, error

**As-of Date**:
The date an opening balance started to apply, which may be years before today.
_Avoid_: Start date, purchase date

**Net Worth**:
Total Assets minus total Liabilities on a given date.
_Avoid_: Wealth, balance

**Net Worth State**:
One of Light (positive), Twilight (within 5% of total Assets of zero) or Dark (negative). It decides the theme.
_Avoid_: Mood, mode

### Ledger

**Entry**:
A dated, balanced record of one money event, made of lines whose debits equal its credits, with a Note.
_Avoid_: Transaction, record, row

**Note**:
The plain-language sentence on an Entry saying what it is about and why it exists.
_Avoid_: Memo, description

**Ledger**:
The append-only collection of all Entries.
_Avoid_: Journal, history

**Reversal**:
An Entry that cancels an earlier Entry exactly and points back to it.
_Avoid_: Delete, undo, void

**Correction**:
The Entry posted after a Reversal that records what should have happened.
_Avoid_: Edit, amendment

**Revaluation**:
An Entry that changes an Asset's value without cash moving, booked as Valuation Gain (Income) or Valuation Loss (Expense).
_Avoid_: Mark-to-market, unrealised gain

### Targets

**Budget**:
A monthly spending limit attached to one or more Expense Accounts. Unused amounts do not carry over.
_Avoid_: Envelope, allowance

**Goal**:
A target amount, with an optional date, attached to a Savings or Investment Account.
_Avoid_: Target, objective

### Chat and AI

**Proposed Entry**:
An Entry the AI has drafted from the user's text and that has not yet been confirmed.
_Avoid_: Suggestion, draft transaction

**Confirm Card**:
The on-screen summary of a Proposed Entry (lines, amount, resolved date, any new Account) that the user accepts or rejects.
_Avoid_: Preview, approval dialog

**Tab Scope**:
The set of Entry kinds a tab's chat is allowed to handle.
_Avoid_: Permissions, intents

**Session**:
One unlocked period during which a password is held in memory and the AI is usable. It ends on lock, tab close or import.
_Avoid_: Login, run

**Rules Engine**:
The component that rejects any Entry or Setup state that would leave the books unbalanced.
_Avoid_: Validator, checker

### Reports

**Actual Sankey**:
The flow diagram of Income to Expenses and Savings/Investments for a date range, taken from the Ledger.
_Avoid_: Flow chart

**Planned Sankey**:
The flow diagram of Income to Budget limits and Goal contributions for the same date range.
_Avoid_: Forecast

**Export File**:
The single JSON file holding all Accounts, Entries, Budgets and Goals with plain-text keys and encrypted values.
_Avoid_: Backup, dump
