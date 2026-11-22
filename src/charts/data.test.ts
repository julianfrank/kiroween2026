import { sankey } from 'd3-sankey';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../ledger/types';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import type { Budget, Goal } from '../targets/types';
import {
  actualSankey, budgetUtilisation, expenseBreakdown, flows, goalMonthlyNeed, goalProjections,
  incomeExpenseTrend, lastMonths, liabilitiesSummary, monthsCovered, netWorthSeries, plannedSankey,
  savingsTrend, type ChartData, type SankeyData,
} from './data';

const TODAY = '2026-11-22';

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2020', ...over };
}

function world() {
  const rows = [
    row({ name: 'Cash', amountText: '1,00,000' }),
    row({ name: 'Delhi', amountText: '40L', asOfText: '10/May/2000' }),
    row({ kind: 'liability', name: 'Loan - Tom', amountText: '20,000' }),
    row({ kind: 'liability', name: 'Card', amountText: '5,000' }),
  ];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const id = (name: string) => [...accounts.values()].find((a) => a.name === name)!.key;
  const d: ChartData = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const post = (date: string, note: string, debit: string, credit: string, amount: number, kind: Entry['kind'] = 'normal') =>
    ledger.append({
      date, note, kind, reverses: null, correctionOf: null, source: 'ai-confirmed',
      lines: [
        { account: id(debit), debitRupees: amount, creditRupees: 0 },
        { account: id(credit), debitRupees: 0, creditRupees: amount },
      ],
    });
  return { d, id, post, ledger };
}

const link = (s: SankeyData, from: string, to: string) =>
  s.links.find((l) => s.nodes.find((n) => n.id === l.source)?.name === from && s.nodes.find((n) => n.id === l.target)?.name === to)?.value;
const outOf = (s: SankeyData, node: string) => s.links.filter((l) => l.source === node).reduce((x, l) => x + l.value, 0);
const into = (s: SankeyData, node: string) => s.links.filter((l) => l.target === node).reduce((x, l) => x + l.value, 0);

describe('periods', () => {
  it('lists 12 months oldest first, the current one ending today', () => {
    const m = lastMonths(TODAY);
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ key: '2025-12', label: 'Dec 2025', from: '2025-12-01', to: '2025-12-31' });
    expect(m[11]).toMatchObject({ key: '2026-11', from: '2026-11-01', to: '2026-11-22' });
  });

  it('counts part months by days', () => {
    expect(monthsCovered('2026-11-01', '2026-11-30')).toBeCloseTo(1);
    expect(monthsCovered('2026-11-01', '2026-11-15')).toBeCloseTo(0.5);
    expect(monthsCovered('2026-10-01', '2026-11-30')).toBeCloseTo(2);
    expect(monthsCovered('2026-11-10', '2026-11-01')).toBe(0);
  });
});

describe('Actual Sankey', () => {
  it('flows income and loans in, and spending, saving and repayments out, and balances', () => {
    const w = world();
    w.post('2026-11-01', 'Salary', 'Cash', 'Salary', 50000);
    w.post('2026-11-05', 'Food', 'Food', 'Cash', 8000);
    w.post('2026-11-06', 'Rent', 'Rent', 'Cash', 12000);
    w.post('2026-11-07', 'Save', 'Savings', 'Cash', 5000);
    w.post('2026-11-08', 'Borrow', 'Cash', 'Loan - Tom', 10000);
    w.post('2026-11-09', 'Repay', 'Card', 'Cash', 2000);
    const s = actualSankey(w.d, '2026-11-01', '2026-11-30');
    expect(s.total).toBe(60000); // 50,000 income + 10,000 loan
    expect(link(s, 'Salary', 'Money in')).toBe(50000);
    expect(link(s, 'Loans taken', 'Money in')).toBe(10000);
    expect(link(s, 'Money in', 'Food')).toBe(8000);
    expect(link(s, 'Money in', 'Rent')).toBe(12000);
    expect(link(s, 'Money in', 'Savings')).toBe(5000);
    expect(link(s, 'Money in', 'Loan repayments')).toBe(2000);
    expect(link(s, 'Money in', 'Kept in accounts')).toBe(33000); // the cash that stayed
    expect(into(s, 'hub')).toBe(outOf(s, 'hub'));
  });

  it('ignores opening balances and other periods', () => {
    const w = world();
    w.post('2026-10-05', 'Food', 'Food', 'Cash', 999);
    expect(actualSankey(w.d, '2026-11-01', '2026-11-30').nodes).toEqual([]);
  });

  it('shows money taken out of savings as its own source, with no cycle', () => {
    const w = world();
    w.post('2026-11-02', 'Save', 'Savings', 'Cash', 5000);
    w.post('2026-11-03', 'Withdraw', 'Cash', 'Savings', 7000);
    w.post('2026-11-04', 'Food', 'Food', 'Cash', 3000);
    const s = actualSankey(w.d, '2026-11-01', '2026-11-30');
    expect(s.nodes.some((n) => n.name === 'Drawn from Savings' && n.kind === 'drawn')).toBe(true);
    expect(s.nodes.some((n) => n.name === 'Savings')).toBe(false);
    expect(() => layout(s)).not.toThrow();
  });

  it('keeps revaluations apart from salary and spending', () => {
    const w = world();
    w.post('2026-11-02', 'Delhi up', 'Delhi', 'Valuation Gain', 100000, 'revaluation');
    w.post('2026-11-03', 'Food', 'Food', 'Cash', 1000);
    w.post('2026-11-04', 'Cash value down', 'Valuation Loss', 'Cash', 500, 'revaluation');
    const s = actualSankey(w.d, '2026-11-01', '2026-11-30');
    expect(s.nodes.find((n) => n.name === 'Valuation Gain (revaluation)')?.kind).toBe('valuation');
    expect(s.nodes.find((n) => n.name === 'Valuation Loss (revaluation)')?.kind).toBe('valuation');
    expect(s.nodes.find((n) => n.name === 'Salary')).toBeUndefined();
    expect(into(s, 'hub')).toBe(outOf(s, 'hub'));
  });

  it('reversed entries cancel', () => {
    const w = world();
    const k = w.post('2026-11-05', 'Food', 'Food', 'Cash', 8000);
    w.ledger.reverse(k, '2026-11-05', 'oops');
    expect(actualSankey(w.d, '2026-11-01', '2026-11-30').nodes).toEqual([]);
  });
});

function layout(s: SankeyData) {
  return sankey<{ id: string }, object>().nodeId((n) => n.id)({
    nodes: s.nodes.map((n) => ({ ...n })),
    links: s.links.map((l) => ({ ...l })),
  });
}

describe('Planned Sankey', () => {
  it('sends income to budget limits, goal needs and the unallocated rest', () => {
    const w = world();
    w.post('2026-11-01', 'Salary', 'Cash', 'Salary', 50000);
    w.d.budgets = new Map<string, Budget>([['budget:1', { name: 'Food', monthlyLimitRupees: 8000, accounts: [w.id('Food')] }]]);
    const goal: Goal = { name: 'Safety net', targetRupees: 12000, targetDate: null, account: w.id('Savings') };
    w.d.goals = new Map([['goal:1', goal]]);
    expect(goalMonthlyNeed(goal, w.ledger, TODAY)).toBe(1000); // 12,000 over 12 months
    const s = plannedSankey(w.d, '2026-11-01', '2026-11-30', TODAY);
    expect(link(s, 'Salary', 'Money in')).toBe(50000);
    expect(link(s, 'Money in', 'Budget: Food')).toBe(8000);
    expect(link(s, 'Money in', 'Goal: Safety net')).toBe(1000);
    expect(link(s, 'Money in', 'Unallocated')).toBe(41000);
    expect(() => layout(s)).not.toThrow();
  });

  it('shows a shortfall when the plan is bigger than the income', () => {
    const w = world();
    w.post('2026-11-01', 'Salary', 'Cash', 'Salary', 5000);
    w.d.budgets = new Map([['budget:1', { name: 'Food', monthlyLimitRupees: 8000, accounts: [w.id('Food')] }]]);
    const s = plannedSankey(w.d, '2026-11-01', '2026-11-30', TODAY);
    expect(link(s, 'Shortfall (plan exceeds income)', 'Money in')).toBe(3000);
    expect(into(s, 'hub')).toBe(outOf(s, 'hub'));
  });

  it('a goal with a date asks for the remainder spread over the months left', () => {
    const w = world();
    const g: Goal = { name: 'Trip', targetRupees: 30000, targetDate: '2027-05-22', account: w.id('Savings') }; // about 6 months
    expect(goalMonthlyNeed(g, w.ledger, TODAY)).toBeGreaterThanOrEqual(5000);
    expect(goalMonthlyNeed(g, w.ledger, TODAY)).toBeLessThanOrEqual(5100);
  });
});

describe('trends and series', () => {
  it('income vs expense vs budget by month, with revaluation on its own line', () => {
    const w = world();
    w.post('2026-10-01', 'Salary', 'Cash', 'Salary', 40000);
    w.post('2026-11-01', 'Salary', 'Cash', 'Salary', 50000);
    w.post('2026-11-05', 'Food', 'Food', 'Cash', 8000);
    w.post('2026-11-06', 'Delhi up', 'Delhi', 'Valuation Gain', 100000, 'revaluation');
    w.d.budgets = new Map([['budget:1', { name: 'Food', monthlyLimitRupees: 9000, accounts: [w.id('Food')] }]]);
    const t = incomeExpenseTrend(w.d, TODAY);
    expect(t.labels).toHaveLength(12);
    const by = (n: string) => t.series.find((s) => s.name.startsWith(n))!.values;
    expect(by('Income').slice(-2)).toEqual([40000, 50000]);
    expect(by('Expenses').slice(-2)).toEqual([0, 8000]);
    expect(by('Budget')).toEqual(Array(12).fill(9000));
    expect(by('Valuation').slice(-2)).toEqual([0, 100000]);
  });

  it('income vs savings and investments vs goal contributions', () => {
    const w = world();
    w.post('2026-11-01', 'Salary', 'Cash', 'Salary', 50000);
    w.post('2026-11-02', 'Save', 'Savings', 'Cash', 6000);
    w.post('2026-11-03', 'Invest', 'Investments', 'Cash', 2000);
    w.d.goals = new Map([['goal:1', { name: 'Net', targetRupees: 24000, targetDate: null, account: w.id('Savings') }]]);
    const t = savingsTrend(w.d, TODAY);
    expect(t.series.find((s) => s.name.startsWith('Saved'))!.values.at(-1)).toBe(8000);
    expect(t.series.find((s) => s.name.startsWith('Goal'))!.values.at(-1)).toBe(Math.ceil((24000 - 6000) / 12));
  });

  it('net worth at each month end, starting from the first month with data', () => {
    const w = world();
    w.post('2026-10-10', 'Salary', 'Cash', 'Salary', 10000);
    const nw = netWorthSeries(w.d, TODAY);
    expect(nw.labels).toHaveLength(12); // the house was bought in 2000
    const base = nw.series[0].values[0];
    expect(nw.series[0].values.at(-1)).toBe(base + 10000);
    expect(nw.series[0].values.at(-2)).toBe(base + 10000); // October end already includes it
    expect(nw.series[0].values[nw.series[0].values.length - 3]).toBe(base);
  });

  it('flows skips opening entries', () => {
    const w = world();
    expect(flows(w.d, '1990-01-01', '2026-12-31').size).toBe(0);
  });
});

describe('breakdowns and progress', () => {
  it('expense breakdown is sorted and labels revaluation losses', () => {
    const w = world();
    w.post('2026-11-05', 'Food', 'Food', 'Cash', 3000);
    w.post('2026-11-06', 'Rent', 'Rent', 'Cash', 9000);
    w.post('2026-11-07', 'Loss', 'Valuation Loss', 'Cash', 100, 'revaluation');
    const b = expenseBreakdown(w.d, '2026-11-01', '2026-11-30');
    expect(b.map((x) => [x.name, x.value])).toEqual([['Rent', 9000], ['Food', 3000], ['Valuation Loss (revaluation)', 100]]);
    expect(b[2].revaluation).toBe(true);
  });

  it('budget utilisation reuses the monthly progress rules', () => {
    const w = world();
    w.post('2026-11-05', 'Food', 'Food', 'Cash', 900);
    w.d.budgets = new Map([['budget:1', { name: 'Food', monthlyLimitRupees: 1000, accounts: [w.id('Food')] }]]);
    expect(budgetUtilisation(w.d, TODAY)[0]).toMatchObject({ name: 'Food', spent: 900, near: true, over: false });
  });

  it('goal projection uses the six-month average and says whether the date is reachable', () => {
    const w = world();
    w.post('2026-09-10', 'Save', 'Savings', 'Cash', 3000);
    w.post('2026-11-10', 'Save', 'Savings', 'Cash', 3000);
    w.d.goals = new Map([
      ['goal:1', { name: 'Net', targetRupees: 12000, targetDate: '2027-06-30', account: w.id('Savings') }],
      ['goal:2', { name: 'Far', targetRupees: 12000, targetDate: '2027-01-31', account: w.id('Savings') }],
      ['goal:3', { name: 'Idle', targetRupees: 500, targetDate: null, account: w.id('Investments') }],
      ['goal:4', { name: 'Done', targetRupees: 5000, targetDate: null, account: w.id('Savings') }],
    ]);
    const p = Object.fromEntries(goalProjections(w.d, TODAY).map((g) => [g.name, g]));
    expect(p.Net).toMatchObject({ saved: 6000, monthlyAverage: 1000, percent: 50 });
    // 6,000 left at 1,000 a month is about 6 months: late May 2027
    expect(p.Net.projectedDate! > '2027-05-01' && p.Net.projectedDate! < '2027-06-30').toBe(true);
    expect(p.Net.onTrack).toBe(true);
    expect(p.Far.onTrack).toBe(false);
    expect(p.Idle).toMatchObject({ projectedDate: null, monthlyAverage: 0, onTrack: null });
    expect(p.Done).toMatchObject({ done: true, projectedDate: TODAY });
  });

  it('liabilities summary lists the biggest first with a total', () => {
    const w = world();
    expect(liabilitiesSummary(w.d)).toEqual({ items: [{ name: 'Loan - Tom', balance: 20000 }, { name: 'Card', balance: 5000 }], total: 25000 });
  });
});
