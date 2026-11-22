import { monthRange } from '../dates/dates';
import type { Ledger } from '../ledger/ledger';
import type { Rupees } from '../money/money';
import type { Budget, Goal } from './types';

export interface BudgetProgress {
  spent: Rupees;
  limit: Rupees;
  remaining: Rupees;
  /** Share of the limit used, 0 to 100+. */
  percent: number;
  over: boolean;
  /** Close to the limit (80% or more) but not over. */
  near: boolean;
}

/** Spending this calendar month (IST) on the budget's expense accounts. */
export function budgetProgress(budget: Budget, ledger: Ledger, today: string): BudgetProgress {
  const { from, to } = monthRange(today);
  const spent = budget.accounts.reduce((s, a) => s + ledger.movement(a, from, to), 0);
  const limit = budget.monthlyLimitRupees;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return { spent, limit, remaining: limit - spent, percent, over: spent > limit, near: spent <= limit && percent >= 80 };
}

export interface GoalProgress {
  saved: Rupees;
  target: Rupees;
  remaining: Rupees;
  percent: number;
  done: boolean;
}

/** What the goal's account holds today, against the target. */
export function goalProgress(goal: Goal, ledger: Ledger, today: string): GoalProgress {
  const saved = ledger.balance(goal.account, today);
  const percent = goal.targetRupees > 0 ? Math.max(0, Math.round((saved / goal.targetRupees) * 100)) : 0;
  return { saved, target: goal.targetRupees, remaining: Math.max(0, goal.targetRupees - saved), percent, done: saved >= goal.targetRupees };
}
