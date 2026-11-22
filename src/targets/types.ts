import type { Rupees } from '../money/money';

/** Monthly spending limit on expense accounts (calendar month, no carry-over). Stored as `budget:<id>`. */
export interface Budget {
  name: string;
  monthlyLimitRupees: Rupees;
  /** Keys of the expense accounts it covers. */
  accounts: string[];
}

/** A target for a savings or investment account. Stored as `goal:<id>`. Progress comes from the ledger. */
export interface Goal {
  name: string;
  targetRupees: Rupees;
  /** ISO date or null. */
  targetDate: string | null;
  /** Key of the savings or investment account. */
  account: string;
}
