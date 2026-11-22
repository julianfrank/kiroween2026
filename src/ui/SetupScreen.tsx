import { useMemo, useState } from 'react';
import { formatDate, todayIso } from '../dates/dates';
import { formatRupees } from '../money/money';
import {
  buildSetup,
  differenceEquity,
  evaluateDraft,
  newId,
  type DraftRow,
  type SetupResult,
} from '../setup/setup';
import { KiroGhost } from '../theme/Crypt';

function blankRow(today: string, kind: DraftRow['kind'] = 'asset'): DraftRow {
  return {
    id: newId('row'),
    kind,
    category: null,
    name: '',
    amountText: '',
    asOfText: formatDate(today),
  };
}

export function SetupScreen({ onDone }: { onDone: (result: SetupResult) => Promise<void> }) {
  const today = useMemo(() => todayIso(), []);
  const [rows, setRows] = useState<DraftRow[]>(() => [blankRow(today), blankRow(today, 'liability')]);
  const [equityText, setEquityText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ev = evaluateDraft(rows, equityText, today);
  const balanced = ev.imbalance === 0;

  const update = (id: string, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function proceed() {
    setSaving(true);
    setError('');
    try {
      await onDone(buildSetup(ev.lines, ev.equity, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const imbalanceText = balanced
    ? 'Balanced'
    : ev.imbalance > 0
      ? `Assets are ${formatRupees(ev.imbalance)} more than Liabilities + Opening Equity`
      : `Assets are ${formatRupees(-ev.imbalance)} less than Liabilities + Opening Equity`;

  return (
    <main style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      <h1>Set up your opening balances</h1>
      <p>
        List what you own and what you owe. Use the date each one started, even if it was years ago
        (a house bought in 2000 is dated 10/May/2000). Dates are DD/MMM/YYYY in Indian Standard
        Time and amounts are whole rupees. The main app opens only when{' '}
        <b>Assets = Liabilities + Opening Equity</b>.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th>Type</th>
            <th>Name</th>
            <th>Amount (₹)</th>
            <th>As of</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ verticalAlign: 'top' }}>
              <td>
                <select
                  value={r.kind === 'asset' ? (r.category ?? 'asset') : 'liability'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'liability') update(r.id, { kind: 'liability', category: null });
                    else update(r.id, { kind: 'asset', category: v === 'asset' ? null : (v as 'savings' | 'investment') });
                  }}
                >
                  <option value="asset">Asset</option>
                  <option value="savings">Asset: savings</option>
                  <option value="investment">Asset: investment</option>
                  <option value="liability">Liability</option>
                </select>
              </td>
              <td>
                <input
                  value={r.name}
                  placeholder={r.kind === 'asset' ? 'House, Bank, Cash' : 'Home loan, Card'}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={r.amountText}
                  placeholder="40L, 5,00,000"
                  inputMode="decimal"
                  onChange={(e) => update(r.id, { amountText: e.target.value })}
                />
              </td>
              <td>
                <input
                  value={r.asOfText}
                  placeholder="DD/MMM/YYYY"
                  aria-label="As-of date (DD/MMM/YYYY, IST)"
                  size={12}
                  onChange={(e) => update(r.id, { asOfText: e.target.value })}
                />
              </td>
              <td>
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                  Remove
                </button>
                {ev.rowErrors.get(r.id) && (
                  <div role="alert" style={{ color: 'var(--bad)' }}>
                    {ev.rowErrors.get(r.id)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <button type="button" onClick={() => setRows((rs) => [...rs, blankRow(today)])}>
          Add a row
        </button>
      </p>

      <section aria-label="Opening Equity">
        <label>
          Opening Equity (₹){' '}
          <input
            value={equityText}
            placeholder="your net worth at the start"
            inputMode="decimal"
            onChange={(e) => setEquityText(e.target.value)}
          />
        </label>{' '}
        <button
          type="button"
          onClick={() => {
            const d = differenceEquity(ev.assets, ev.liabilities);
            setEquityText(String(d));
          }}
        >
          Use difference
        </button>
        {ev.equityError && (
          <div role="alert" style={{ color: 'var(--bad)' }}>
            {ev.equityError}
          </div>
        )}
      </section>

      <section
        aria-live="polite"
        className={`imbalance-panel ${balanced ? 'balanced' : 'unbalanced'}`}
        style={{
          margin: '16px 0',
          padding: 16,
          border: `3px solid ${balanced ? 'var(--good)' : 'var(--bad)'}`,
          borderRadius: 8,
        }}
      >
        <div>Assets {formatRupees(ev.assets)}</div>
        <div>
          Liabilities {formatRupees(ev.liabilities)} + Opening Equity {formatRupees(ev.equity)} ={' '}
          {formatRupees(ev.liabilities + ev.equity)}
        </div>
        <div className="panel-ghost">
          <KiroGhost size={48} mood={balanced ? 'cheer' : 'worried'} />
        </div>
        <div className="imbalance-figure" style={{ fontSize: 28, fontWeight: 700, color: balanced ? 'var(--good)' : 'var(--bad)' }}>
          Imbalance: {formatRupees(ev.imbalance)}
        </div>
        <div>{imbalanceText}</div>
      </section>

      <button type="button" disabled={!ev.canContinue || saving} onClick={proceed}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
