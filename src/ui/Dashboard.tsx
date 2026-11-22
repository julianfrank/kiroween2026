import { useState } from 'react';
import { Bars } from '../charts/Bars';
import {
  actualSankey, budgetUtilisation, expenseBreakdown, goalProjections, incomeExpenseTrend,
  lastMonths, liabilitiesSummary, netWorthSeries, plannedSankey, savingsTrend,
} from '../charts/data';
import { LineChart } from '../charts/LineChart';
import { SankeyChart } from '../charts/Sankey';
import { formatDate, monthRange, parseDisplayDate, todayIso } from '../dates/dates';
import { addDays } from '../dates/resolve';
import { formatRupees } from '../money/money';
import type { LoadedData } from '../store/repo';

type Sub = 'trend' | 'savings' | 'networth' | 'expenses' | 'budgets' | 'goals' | 'liabilities';
const SUBS: Array<[Sub, string]> = [
  ['trend', 'Income vs Expense vs Budget'],
  ['savings', 'Savings, Investments and Goals'],
  ['networth', 'Net worth'],
  ['expenses', 'Expense breakdown'],
  ['budgets', 'Budget utilisation'],
  ['goals', 'Goal progress'],
  ['liabilities', 'Liabilities summary'],
];

function presets(today: string): Array<[string, string, string]> {
  const m = monthRange(today);
  const prev = monthRange(addDays(m.from, -1));
  return [
    ['This month', m.from, today],
    ['Last month', prev.from, prev.to],
    ['Last 3 months', lastMonths(today, 3)[0].from, today],
    ['Last 12 months', lastMonths(today, 12)[0].from, today],
  ];
}

export function Dashboard({ data }: { data: LoadedData }) {
  const today = todayIso();
  const month = monthRange(today);
  const [range, setRange] = useState({ from: month.from, to: today });
  const [fromText, setFromText] = useState(formatDate(month.from));
  const [toText, setToText] = useState(formatDate(today));
  const [sub, setSub] = useState<Sub>('trend');

  function apply(f: string, t: string) {
    const from = parseDisplayDate(f);
    const to = parseDisplayDate(t);
    if (from && to && from <= to) setRange({ from, to });
  }
  const fromIso = parseDisplayDate(fromText);
  const toIso = parseDisplayDate(toText);
  const rangeError =
    !fromIso || !toIso ? 'Enter both dates as DD/MMM/YYYY (IST).' : fromIso > toIso ? 'The start date must not be after the end date.' : '';

  const accounts = [...data.accounts.values()];
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + data.ledger.balance(a.key), 0);
  const liabilities = accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + data.ledger.balance(a.key), 0);

  const actual = actualSankey(data, range.from, range.to);
  const planned = plannedSankey(data, range.from, range.to, today);

  return (
    <div>
      <p style={{ fontSize: 24, margin: '4px 0' }}>
        Net worth <b>{formatRupees(assets - liabilities)}</b>
      </p>
      <p style={{ margin: '4px 0' }}>
        Assets {formatRupees(assets)}, Liabilities {formatRupees(liabilities)}
      </p>

      <section aria-label="Date range" style={{ margin: '12px 0' }}>
        <label>
          From{' '}
          <input
            aria-label="From date"
            size={12}
            value={fromText}
            placeholder="DD/MMM/YYYY"
            onChange={(e) => {
              setFromText(e.target.value);
              apply(e.target.value, toText);
            }}
          />
        </label>{' '}
        <label>
          To{' '}
          <input
            aria-label="To date"
            size={12}
            value={toText}
            placeholder="DD/MMM/YYYY"
            onChange={(e) => {
              setToText(e.target.value);
              apply(fromText, e.target.value);
            }}
          />
        </label>{' '}
        {presets(today).map(([label, f, t]) => (
          <button
            key={label}
            onClick={() => {
              setFromText(formatDate(f));
              setToText(formatDate(t));
              setRange({ from: f, to: t });
            }}
          >
            {label}
          </button>
        ))}
        {rangeError && <div role="alert" style={{ color: 'crimson' }}>{rangeError}</div>}
        <div style={{ opacity: 0.7 }}>
          Showing {formatDate(range.from)} to {formatDate(range.to)}. Opening balances are not counted as activity.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <figure style={{ margin: 0 }}>
          <figcaption><b>Actual</b>: where the money came from and went</figcaption>
          <SankeyChart data={actual} title="Actual Sankey" />
        </figure>
        <figure style={{ margin: 0 }}>
          <figcaption><b>Planned</b>: income against budget limits and goal needs</figcaption>
          <SankeyChart data={planned} title="Planned Sankey" />
        </figure>
      </div>
      <p style={{ opacity: 0.7, fontSize: 12 }}>
        Purple flows are revaluations of assets (Valuation Gain and Loss), not salary or spending.
      </p>

      <nav aria-label="Charts" style={{ margin: '12px 0' }}>
        {SUBS.map(([id, label]) => (
          <button key={id} aria-pressed={sub === id} onClick={() => setSub(id)} style={{ fontWeight: sub === id ? 700 : 400, marginRight: 6 }}>
            {label}
          </button>
        ))}
      </nav>

      <section aria-label={SUBS.find(([id]) => id === sub)![1]}>
        {sub === 'trend' && <LineChart data={incomeExpenseTrend(data, today)} title="Income vs Expense vs Budget, last 12 months" />}
        {sub === 'savings' && <LineChart data={savingsTrend(data, today)} title="Income vs Savings and Investments vs Goals, last 12 months" />}
        {sub === 'networth' && <LineChart data={netWorthSeries(data, today)} title="Net worth at each month end" />}
        {sub === 'expenses' && (
          <Bars
            title="Expense breakdown"
            items={expenseBreakdown(data, range.from, range.to).map((e) => ({
              label: e.name,
              value: e.value,
              color: e.revaluation ? '#7b1fa2' : '#c62828',
            }))}
          />
        )}
        {sub === 'budgets' && (
          <Bars
            title="Budget utilisation this month"
            items={budgetUtilisation(data, today).map((b) => ({
              label: b.name,
              value: b.spent,
              of: b.limit,
              color: b.over ? '#c62828' : b.near ? '#f9a825' : '#2e7d32',
              note: `of ${formatRupees(b.limit)} (${b.percent}%)${b.over ? ', over the limit' : ''}`,
            }))}
          />
        )}
        {sub === 'goals' && (
          <Bars
            title="Goal progress"
            items={goalProjections(data, today).map((g) => ({
              label: g.name,
              value: g.saved,
              of: g.target,
              color: g.done || g.onTrack ? '#2e7d32' : g.onTrack === false ? '#c62828' : '#1565c0',
              note: g.done
                ? `of ${formatRupees(g.target)}, reached`
                : `of ${formatRupees(g.target)} (${g.percent}%). ${
                    g.projectedDate
                      ? `At ${formatRupees(g.monthlyAverage)} a month: ${formatDate(g.projectedDate)}${g.targetDate ? (g.onTrack ? ', on track' : `, after the target ${formatDate(g.targetDate)}`) : ''}`
                      : 'No recent savings, so no projected date'
                  }`,
            }))}
          />
        )}
        {sub === 'liabilities' && (
          <div>
            <Bars
              title="Liabilities"
              items={liabilitiesSummary(data).items.map((l) => ({ label: l.name, value: l.balance, color: '#ad1457' }))}
            />
            <p>Total owed: <b>{formatRupees(liabilitiesSummary(data).total)}</b></p>
          </div>
        )}
      </section>
    </div>
  );
}
