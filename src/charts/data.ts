// Pure data builders for the dashboard. Everything is computed from the ledger, budgets and goals.
// Opening entries (setup balances) are never counted as flows: they are starting positions, not activity.

import { monthRange } from '../dates/dates';
import { addDays } from '../dates/resolve';
import type { Ledger } from '../ledger/ledger';
import { DEBIT_NORMAL, type Account } from '../ledger/types';
import type { Rupees } from '../money/money';
import { budgetProgress, goalProgress } from '../targets/progress';
import type { Budget, Goal } from '../targets/types';

export interface ChartData {
  accounts: ReadonlyMap<string, Account>;
  ledger: Ledger;
  budgets: ReadonlyMap<string, Budget>;
  goals: ReadonlyMap<string, Goal>;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isSaving = (a: Account) => a.kind === 'asset' && (a.category === 'savings' || a.category === 'investment');

// ---------------------------------------------------------------------------------------------
// Flows and dates
// ---------------------------------------------------------------------------------------------

/** Net movement per account between two dates, in each account's normal direction, opening entries excluded. */
export function flows(d: Pick<ChartData, 'accounts' | 'ledger'>, from: string, to: string): Map<string, Rupees> {
  const raw = new Map<string, number>();
  for (const e of d.ledger.entries.values()) {
    if (e.kind === 'opening' || e.date < from || e.date > to) continue;
    for (const l of e.lines) raw.set(l.account, (raw.get(l.account) ?? 0) + l.debitRupees - l.creditRupees);
  }
  const out = new Map<string, Rupees>();
  for (const [key, v] of raw) {
    const a = d.accounts.get(key);
    if (!a || v === 0) continue;
    out.set(key, DEBIT_NORMAL.has(a.kind) ? v : -v);
  }
  return out;
}

export interface MonthPoint {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** The last `n` calendar months (IST), oldest first. The current month ends today. */
export function lastMonths(today: string, n = 12): MonthPoint[] {
  const [y, m] = today.split('-').map(Number);
  const out: MonthPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    const r = monthRange(`${yy}-${String(mm).padStart(2, '0')}-01`);
    out.push({
      key: `${yy}-${String(mm).padStart(2, '0')}`,
      label: `${MONTH_ABBR[mm - 1]} ${yy}`,
      from: r.from,
      to: r.to > today ? today : r.to,
    });
  }
  return out;
}

function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** How many months a date range covers, counting part-months by days (a full calendar month is 1). */
export function monthsCovered(from: string, to: string): number {
  if (to < from) return 0;
  let total = 0;
  let cursor = from;
  while (cursor <= to) {
    const r = monthRange(cursor);
    const end = r.to < to ? r.to : to;
    total += (daysBetween(cursor, end) + 1) / (daysBetween(r.from, r.to) + 1);
    cursor = addDays(r.to, 1);
  }
  return total;
}

/** Monthly amount a goal needs from now: what is left over the months until its date (12 if it has none). */
export function goalMonthlyNeed(goal: Goal, ledger: Ledger, today: string): Rupees {
  const remaining = Math.max(0, goal.targetRupees - ledger.balance(goal.account, today));
  if (remaining === 0) return 0;
  const months = goal.targetDate ? Math.max(1, daysBetween(today, goal.targetDate) / 30.4375) : 12;
  return Math.ceil(remaining / months);
}

// ---------------------------------------------------------------------------------------------
// Sankey
// ---------------------------------------------------------------------------------------------

export type NodeKind =
  | 'income' | 'valuation' | 'borrowed' | 'drawn' | 'hub'
  | 'expense' | 'saving' | 'repayment' | 'kept' | 'budget' | 'goal' | 'gap' | 'unallocated';

export interface SankeyNode { id: string; name: string; kind: NodeKind }
export interface SankeyLink { source: string; target: string; value: Rupees }
export interface SankeyData { nodes: SankeyNode[]; links: SankeyLink[]; total: Rupees }

interface Part { id: string; name: string; kind: NodeKind; value: Rupees }

/** sources -> "Money in" -> targets. Both sides always add up to the same total, so the picture balances. */
function assemble(sources: Part[], targets: Part[]): SankeyData {
  const src = sources.filter((p) => p.value > 0);
  const dst = targets.filter((p) => p.value > 0);
  const total = src.reduce((s, p) => s + p.value, 0);
  const outTotal = dst.reduce((s, p) => s + p.value, 0);
  if (total === 0 || total !== outTotal) return { nodes: [], links: [], total: 0 };
  const hub: SankeyNode = { id: 'hub', name: 'Money in', kind: 'hub' };
  return {
    total,
    nodes: [...src.map(({ id, name, kind }) => ({ id, name, kind })), hub, ...dst.map(({ id, name, kind }) => ({ id, name, kind }))],
    links: [
      ...src.map((p) => ({ source: p.id, target: 'hub', value: p.value })),
      ...dst.map((p) => ({ source: 'hub', target: p.id, value: p.value })),
    ],
  };
}

const VAL_GAIN = 'Valuation Gain (revaluation)';
const VAL_LOSS = 'Valuation Loss (revaluation)';

/** What actually happened between two dates: income and borrowing in; spending, saving and repayments out. */
export function actualSankey(d: Pick<ChartData, 'accounts' | 'ledger'>, from: string, to: string): SankeyData {
  const f = flows(d, from, to);
  const sources: Part[] = [];
  const targets: Part[] = [];
  let loansTaken = 0;
  let loansRepaid = 0;

  for (const a of d.accounts.values()) {
    const v = f.get(a.key) ?? 0;
    if (v === 0) continue;
    if (a.kind === 'income' && v > 0) {
      const gain = a.system === 'valuation-gain';
      sources.push({ id: `in:${a.key}`, name: gain ? VAL_GAIN : a.name, kind: gain ? 'valuation' : 'income', value: v });
    } else if (a.kind === 'expense' && v > 0) {
      const loss = a.system === 'valuation-loss';
      targets.push({ id: `out:${a.key}`, name: loss ? VAL_LOSS : a.name, kind: loss ? 'valuation' : 'expense', value: v });
    } else if (isSaving(a)) {
      if (v > 0) targets.push({ id: `sav:${a.key}`, name: a.name, kind: 'saving', value: v });
      else sources.push({ id: `draw:${a.key}`, name: `Drawn from ${a.name}`, kind: 'drawn', value: -v });
    } else if (a.kind === 'liability') {
      if (v > 0) loansTaken += v;
      else loansRepaid += -v;
    }
  }
  if (loansTaken > 0) sources.push({ id: 'in:loans', name: 'Loans taken', kind: 'borrowed', value: loansTaken });
  if (loansRepaid > 0) targets.push({ id: 'out:loans', name: 'Loan repayments', kind: 'repayment', value: loansRepaid });

  // Whatever is left is the change in your other accounts (cash, bank, property).
  const gap = sources.reduce((s, p) => s + p.value, 0) - targets.reduce((s, p) => s + p.value, 0);
  if (gap > 0) targets.push({ id: 'out:kept', name: 'Kept in accounts', kind: 'kept', value: gap });
  if (gap < 0) sources.push({ id: 'in:accounts', name: 'Drawn from accounts', kind: 'drawn', value: -gap });
  return assemble(sources, targets);
}

/** What the plan says: income against budget limits and goal contributions for the same period. */
export function plannedSankey(d: ChartData, from: string, to: string, today: string): SankeyData {
  const f = flows(d, from, to);
  const sources: Part[] = [];
  for (const a of d.accounts.values()) {
    const v = f.get(a.key) ?? 0;
    if (a.kind === 'income' && !a.system && v > 0) sources.push({ id: `in:${a.key}`, name: a.name, kind: 'income', value: v });
  }
  const months = monthsCovered(from, to);
  const targets: Part[] = [];
  for (const [key, b] of d.budgets) {
    targets.push({ id: `budget:${key}`, name: `Budget: ${b.name}`, kind: 'budget', value: Math.round(b.monthlyLimitRupees * months) });
  }
  for (const [key, g] of d.goals) {
    targets.push({ id: `goal:${key}`, name: `Goal: ${g.name}`, kind: 'goal', value: Math.round(goalMonthlyNeed(g, d.ledger, today) * months) });
  }
  const income = sources.reduce((s, p) => s + p.value, 0);
  const planned = targets.reduce((s, p) => s + p.value, 0);
  if (planned > income) sources.push({ id: 'in:gap', name: 'Shortfall (plan exceeds income)', kind: 'gap', value: planned - income });
  if (income > planned) targets.push({ id: 'out:free', name: 'Unallocated', kind: 'unallocated', value: income - planned });
  return assemble(sources, targets);
}

// ---------------------------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------------------------

export interface Series { name: string; values: Rupees[] }
export interface TrendData { labels: string[]; series: Series[] }

const sumKind = (d: Pick<ChartData, 'accounts'>, f: Map<string, Rupees>, pick: (a: Account) => boolean) =>
  [...d.accounts.values()].filter(pick).reduce((s, a) => s + (f.get(a.key) ?? 0), 0);

/** Income, spending and the budget for each of the last 12 months. Revaluations are a separate line. */
export function incomeExpenseTrend(d: ChartData, today: string): TrendData {
  const months = lastMonths(today);
  const budget = [...d.budgets.values()].reduce((s, b) => s + b.monthlyLimitRupees, 0);
  const income: Rupees[] = [];
  const expense: Rupees[] = [];
  const valuation: Rupees[] = [];
  for (const m of months) {
    const f = flows(d, m.from, m.to);
    income.push(sumKind(d, f, (a) => a.kind === 'income' && !a.system));
    expense.push(sumKind(d, f, (a) => a.kind === 'expense' && !a.system));
    valuation.push(
      sumKind(d, f, (a) => a.system === 'valuation-gain') - sumKind(d, f, (a) => a.system === 'valuation-loss'),
    );
  }
  const series: Series[] = [
    { name: 'Income', values: income },
    { name: 'Expenses', values: expense },
  ];
  if (d.budgets.size) series.push({ name: 'Budget (all limits)', values: months.map(() => budget) });
  series.push({ name: 'Valuation gain/loss (revaluation, net)', values: valuation });
  return { labels: months.map((m) => m.label), series };
}

/** Income, money put into savings and investments, and what the goals ask for each month. */
export function savingsTrend(d: ChartData, today: string): TrendData {
  const months = lastMonths(today);
  const need = [...d.goals.values()].reduce((s, g) => s + goalMonthlyNeed(g, d.ledger, today), 0);
  const income: Rupees[] = [];
  const saved: Rupees[] = [];
  for (const m of months) {
    const f = flows(d, m.from, m.to);
    income.push(sumKind(d, f, (a) => a.kind === 'income' && !a.system));
    saved.push(sumKind(d, f, isSaving));
  }
  const series: Series[] = [
    { name: 'Income', values: income },
    { name: 'Saved and invested (net)', values: saved },
  ];
  if (d.goals.size) series.push({ name: 'Goal contributions needed', values: months.map(() => need) });
  return { labels: months.map((m) => m.label), series };
}

/** Net worth at the end of each of the last 12 months, starting from the first month with any data. */
export function netWorthSeries(d: Pick<ChartData, 'ledger'>, today: string): TrendData {
  const dates = [...d.ledger.entries.values()].map((e) => e.date).sort();
  const first = dates[0];
  const months = lastMonths(today).filter((m) => first !== undefined && m.to >= first);
  return {
    labels: months.map((m) => m.label),
    series: [{ name: 'Net worth', values: months.map((m) => d.ledger.netWorth(m.to)) }],
  };
}

// ---------------------------------------------------------------------------------------------
// Breakdowns and progress
// ---------------------------------------------------------------------------------------------

export interface BreakdownItem { name: string; value: Rupees; revaluation: boolean }

export function expenseBreakdown(d: Pick<ChartData, 'accounts' | 'ledger'>, from: string, to: string): BreakdownItem[] {
  const f = flows(d, from, to);
  return [...d.accounts.values()]
    .filter((a) => a.kind === 'expense' && (f.get(a.key) ?? 0) > 0)
    .map((a) => ({ name: a.system === 'valuation-loss' ? VAL_LOSS : a.name, value: f.get(a.key)!, revaluation: a.system === 'valuation-loss' }))
    .sort((x, y) => y.value - x.value);
}

export function budgetUtilisation(d: ChartData, today: string) {
  return [...d.budgets.values()].map((b) => ({ name: b.name, ...budgetProgress(b, d.ledger, today) }));
}

export interface GoalProjection {
  name: string;
  saved: Rupees;
  target: Rupees;
  percent: number;
  done: boolean;
  targetDate: string | null;
  /** Average net added per month over the last 6 calendar months. */
  monthlyAverage: Rupees;
  /** ISO date at the current pace, or null when nothing is being added. */
  projectedDate: string | null;
  onTrack: boolean | null;
}

export function goalProjections(d: ChartData, today: string): GoalProjection[] {
  const months = lastMonths(today, 6);
  const from = months[0].from;
  return [...d.goals.values()].map((g) => {
    const p = goalProgress(g, d.ledger, today);
    const added = flows(d, from, today).get(g.account) ?? 0;
    const monthlyAverage = Math.round(added / 6);
    let projectedDate: string | null = null;
    if (p.done) projectedDate = today;
    else if (monthlyAverage > 0) projectedDate = addDays(today, Math.ceil((p.remaining / monthlyAverage) * 30.4375));
    const onTrack = g.targetDate && projectedDate ? projectedDate <= g.targetDate : g.targetDate && !projectedDate ? false : null;
    return { name: g.name, saved: p.saved, target: p.target, percent: p.percent, done: p.done, targetDate: g.targetDate, monthlyAverage, projectedDate, onTrack };
  });
}

export interface LiabilityItem { name: string; balance: Rupees }

export function liabilitiesSummary(d: Pick<ChartData, 'accounts' | 'ledger'>): { items: LiabilityItem[]; total: Rupees } {
  const items = [...d.accounts.values()]
    .filter((a) => a.kind === 'liability')
    .map((a) => ({ name: a.name, balance: d.ledger.balance(a.key) }))
    .filter((i) => i.balance !== 0)
    .sort((a, b) => b.balance - a.balance);
  return { items, total: items.reduce((s, i) => s + i.balance, 0) };
}
