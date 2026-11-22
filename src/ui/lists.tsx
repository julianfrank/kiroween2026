import { useState } from 'react';
import { draftFromEntry, resolveAny } from '../chat/draft';
import { formatDate, todayIso } from '../dates/dates';
import { formatRupees } from '../money/money';
import { commitCorrection, commitReversal, type LoadedData } from '../store/repo';
import { budgetProgress, goalProgress } from '../targets/progress';
import type { Vault } from '../store/vault';
import { ConfirmCard } from './ConfirmCard';

const cell = { paddingRight: 16, textAlign: 'left' as const };

export function AccountList({ data, kind }: { data: LoadedData; kind: 'asset' | 'liability' }) {
  const rows = [...data.accounts.values()].filter((a) => a.kind === kind && !a.system);
  if (rows.length === 0) return <p>No {kind} accounts yet.</p>;
  return (
    <table aria-label={kind === 'asset' ? 'Assets' : 'Liabilities'}>
      <thead>
        <tr>
          <th style={cell}>Name</th>
          <th style={cell}>Since</th>
          <th style={cell}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.key}>
            <td style={cell}>
              {a.name}
              {a.category ? ` (${a.category})` : ''}
            </td>
            <td style={cell}>{formatDate(a.asOfDate)}</td>
            <td style={cell}>{formatRupees(data.ledger.balance(a.key))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GoalsList({ data }: { data: LoadedData }) {
  const today = todayIso();
  if (data.goals.size === 0) return <p>No goals yet. Try “Save 3L for an emergency fund by Dec 2027”.</p>;
  return (
    <ul aria-label="Goals" style={{ listStyle: 'none', padding: 0 }}>
      {[...data.goals.entries()].map(([key, g]) => {
        const p = goalProgress(g, data.ledger, today);
        return (
          <li key={key} style={{ margin: '8px 0' }}>
            <b>{g.name}</b>: {formatRupees(p.saved)} of {formatRupees(p.target)} ({p.percent}%)
            {g.targetDate ? `, by ${formatDate(g.targetDate)}` : ''} {p.done ? '✔ reached' : `, ${formatRupees(p.remaining)} to go`}
            <div>
              <progress value={Math.min(p.percent, 100)} max={100} aria-label={`${g.name} progress`} style={{ width: 240 }} />
            </div>
            <div style={{ opacity: 0.7 }}>Saved in {data.accounts.get(g.account)?.name ?? 'unknown account'}</div>
          </li>
        );
      })}
    </ul>
  );
}

export function BudgetsList({ data }: { data: LoadedData }) {
  const today = todayIso();
  if (data.budgets.size === 0) return <p>No budgets yet. Try “Set a monthly budget of 8000 for Food”.</p>;
  return (
    <ul aria-label="Budgets" style={{ listStyle: 'none', padding: 0 }}>
      {[...data.budgets.entries()].map(([key, b]) => {
        const p = budgetProgress(b, data.ledger, today);
        return (
          <li key={key} style={{ margin: '8px 0' }}>
            <b>{b.name}</b> this month: {formatRupees(p.spent)} of {formatRupees(p.limit)} ({p.percent}%)
            {p.over && <span style={{ color: 'crimson' }}> Over by {formatRupees(-p.remaining)}</span>}
            {p.near && <span style={{ color: '#a60' }}> Nearly used up, {formatRupees(p.remaining)} left</span>}
            {!p.over && !p.near && <span>, {formatRupees(p.remaining)} left</span>}
            <div>
              <progress value={Math.min(p.percent, 100)} max={100} aria-label={`${b.name} budget used`} style={{ width: 240 }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DailyList({
  data,
  vault,
  onChanged,
}: {
  data: LoadedData;
  vault: Vault;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<{ key: string; mode: 'reverse' | 'correct' } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const today = todayIso();

  const rows = [...data.ledger.entries.entries()]
    .sort(([ak, a], [bk, b]) => (b.date + bk).localeCompare(a.date + ak))
    .slice(0, 50);

  const ctx = {
    accounts: data.accounts,
    budgets: data.budgets,
    goals: data.goals,
    today,
    balanceOf: (k: string) => data.ledger.balance(k),
  };

  async function reverse(key: string) {
    setError('');
    try {
      await commitReversal(vault, data, key, reason.trim());
      setOpen(null);
      setReason('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (rows.length === 0) return <p>No entries yet.</p>;
  return (
    <ul aria-label="Entries" style={{ paddingLeft: 18 }}>
      {rows.map(([key, e]) => {
        const reversed = data.ledger.isReversed(key);
        const initial = !reversed ? draftFromEntry(e, data.accounts) : null;
        const canReverse = !reversed && (e.kind === 'normal' || e.kind === 'correction' || e.kind === 'revaluation');
        return (
          <li key={key} style={{ margin: '6px 0' }}>
            <span style={{ textDecoration: reversed ? 'line-through' : 'none' }}>
              <b>{formatDate(e.date)}</b> {e.note}
            </span>
            {reversed && <i> (reversed)</i>}
            {e.kind === 'reversal' && <i> [reversal]</i>}
            {e.kind === 'correction' && <i> [correction]</i>}{' '}
            {canReverse && (
              <button onClick={() => { setOpen({ key, mode: 'reverse' }); setReason(''); setError(''); }}>Reverse</button>
            )}{' '}
            {initial && <button onClick={() => { setOpen({ key, mode: 'correct' }); setError(''); }}>Correct</button>}

            {open?.key === key && open.mode === 'reverse' && (
              <div>
                <input aria-label="Reason for reversal" placeholder="Why is this being reversed?" value={reason} onChange={(ev) => setReason(ev.target.value)} />{' '}
                <button disabled={reason.trim() === ''} onClick={() => void reverse(key)}>Reverse entry</button>{' '}
                <button onClick={() => setOpen(null)}>Cancel</button>
                {error && <div role="alert">{error}</div>}
              </div>
            )}
            {open?.key === key && open.mode === 'correct' && initial && (
              <ConfirmCard
                tab="daily"
                title="Correct this entry (the original is reversed and a corrected entry is posted)"
                askReason
                initial={initial}
                questions={[]}
                ctx={ctx}
                onCancel={() => setOpen(null)}
                onConfirm={async (draft, why) => {
                  const r = resolveAny(draft, ctx);
                  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' '));
                  if (r.kind !== 'entry') throw new Error('Only ledger entries can be corrected.');
                  await commitCorrection(vault, data, key, why, r.newAccounts, r.entry);
                  setOpen(null);
                  onChanged();
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
