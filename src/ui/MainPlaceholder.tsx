import type { LoadedData } from '../store/repo';
import { formatDate } from '../dates/dates';
import { formatRupees } from '../money/money';

// Temporary view so the setup result is visible. Task 8 replaces it with the six tabs.
export function MainPlaceholder({ data }: { data: LoadedData }) {
  const accounts = [...data.accounts.values()];
  const rows = accounts
    .filter((a) => a.kind === 'asset' || a.kind === 'liability')
    .map((a) => ({ a, bal: data.ledger.balance(a.key) }));
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Unlocked</h1>
      <p>
        Net worth: <b>{formatRupees(data.ledger.netWorth())}</b>. The main tabs arrive in Task 8.
      </p>
      <table>
        <tbody>
          {rows.map(({ a, bal }) => (
            <tr key={a.key}>
              <td style={{ paddingRight: 16 }}>{a.name}</td>
              <td style={{ paddingRight: 16 }}>{a.kind}</td>
              <td style={{ paddingRight: 16 }}>since {formatDate(a.asOfDate)}</td>
              <td>{formatRupees(bal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
