import { useState } from 'react';
import type { AiHost } from '../ai/host';
import { CHAT_TABS, TAB_LABELS, type ChatTabId } from '../chat/intents';
import { formatDate } from '../dates/dates';
import { formatRupees } from '../money/money';
import type { LoadedData } from '../store/repo';
import type { Vault } from '../store/vault';
import { ChatPanel, type Incoming } from './ChatPanel';

// Temporary shell so the chat pipeline can be used. Task 8 replaces it with the real six tabs.
export function MainPlaceholder({
  data,
  vault,
  host,
  onChanged,
}: {
  data: LoadedData;
  vault: Vault;
  host: AiHost;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<ChatTabId>('daily');
  const [incoming, setIncoming] = useState<Partial<Record<ChatTabId, Incoming>>>({});

  const balances = [...data.accounts.values()]
    .filter((a) => a.kind === 'asset' || a.kind === 'liability')
    .map((a) => ({ a, bal: data.ledger.balance(a.key) }));
  const recent = [...data.ledger.entries.entries()]
    .sort(([ak, a], [bk, b]) => (b.date + bk).localeCompare(a.date + ak))
    .slice(0, 8);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Unlocked</h1>
      <p>
        Net worth: <b>{formatRupees(data.ledger.netWorth())}</b>. The real tabs arrive in Task 8; for now pick a
        chat tab to try entries.
      </p>

      <nav aria-label="Chat tabs" style={{ margin: '12px 0' }}>
        {CHAT_TABS.map((t) => (
          <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)} style={{ fontWeight: t === tab ? 700 : 400, marginRight: 6 }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {CHAT_TABS.map((t) => (
        <div key={t} hidden={t !== tab}>
          <ChatPanel
            tab={t}
            host={host}
            vault={vault}
            data={data}
            onChanged={onChanged}
            incoming={incoming[t]}
            onSwitchTab={(to, text) => {
              setIncoming((m) => ({ ...m, [to]: { id: Date.now(), text } }));
              setTab(to);
            }}
          />
        </div>
      ))}

      <h2>Accounts</h2>
      <table>
        <tbody>
          {balances.map(({ a, bal }) => (
            <tr key={a.key}>
              <td style={{ paddingRight: 16 }}>{a.name}</td>
              <td style={{ paddingRight: 16 }}>{a.kind}</td>
              <td style={{ paddingRight: 16 }}>since {formatDate(a.asOfDate)}</td>
              <td>{formatRupees(bal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Latest entries</h2>
      <ul>
        {recent.map(([key, e]) => (
          <li key={key}>
            <b>{formatDate(e.date)}</b> {e.note}
          </li>
        ))}
      </ul>
    </main>
  );
}
