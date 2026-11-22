import { useCallback, useState, type ReactNode } from 'react';
import type { PromptHost } from '../chat/proposal';
import { CHAT_TABS, TAB_LABELS, type ChatTabId } from '../chat/intents';
import { todayIso } from '../dates/dates';
import type { Entry } from '../ledger/types';
import type { LoadedData } from '../store/repo';
import { Ambient, Ghost, Pumpkin } from '../theme/Decor';
import { EntryAnimation } from '../theme/EntryAnimation';
import { eventFromEntry, type EntryEvent } from '../theme/events';
import { netWorthState, STATE_TEXT, useTheme } from '../theme/theme';
import type { Vault } from '../store/vault';
import { ChatPanel, type Incoming } from './ChatPanel';
import { Dashboard } from './Dashboard';
import { AccountList, BudgetsList, DailyList, GoalsList } from './lists';

type TabId = 'dashboard' | ChatTabId;
const ORDER: TabId[] = ['dashboard', 'assets', 'liabilities', 'goals', 'budgets', 'daily'];
const LABEL = (t: TabId) => (t === 'dashboard' ? 'Dashboard' : TAB_LABELS[t]);

export function AppShell({
  data,
  vault,
  host,
  onChanged,
  dataPanel,
}: {
  data: LoadedData;
  vault: Vault;
  host: PromptHost;
  onChanged: () => void;
  /** Export, import and password change, shown from the header. */
  dataPanel?: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [incoming, setIncoming] = useState<Partial<Record<ChatTabId, Incoming>>>({});
  const [event, setEvent] = useState<EntryEvent | null>(null);
  const [showData, setShowData] = useState(false);
  const clearEvent = useCallback(() => setEvent(null), []);
  const onEntry = (e: Entry) => {
    const ev = eventFromEntry(e, data.accounts);
    if (ev) setEvent(ev);
  };

  // The look of the whole app follows net worth and changes the moment it changes.
  const today = todayIso();
  const accounts = [...data.accounts.values()];
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + data.ledger.balance(a.key, today), 0);
  const liabilities = accounts.filter((a) => a.kind === 'liability').reduce((s, a) => s + data.ledger.balance(a.key, today), 0);
  const state = netWorthState(assets - liabilities, assets);
  useTheme(state);

  const body = (t: ChatTabId) => {
    switch (t) {
      case 'assets':
        return <AccountList data={data} kind="asset" vault={vault} onChanged={onChanged} />;
      case 'liabilities':
        return <AccountList data={data} kind="liability" vault={vault} onChanged={onChanged} />;
      case 'goals':
        return <GoalsList data={data} />;
      case 'budgets':
        return <BudgetsList data={data} />;
      case 'daily':
        return <DailyList data={data} vault={vault} onChanged={onChanged} onEntry={onEntry} />;
    }
  };

  return (
    <>
    <Ambient state={state} />
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header className="app-header">
        {state === 'light' ? <Pumpkin /> : <Ghost />}
        <h1 className="title-glow">Scary Money Manager</h1>
        <span className="state-chip" role="status" data-state={state}>
          {STATE_TEXT[state].title}: {STATE_TEXT[state].line}
        </span>
        {dataPanel && (
          <button aria-expanded={showData} onClick={() => setShowData((s) => !s)} style={{ marginLeft: 'auto' }}>
            Data and password
          </button>
        )}
      </header>
      {dataPanel && showData && dataPanel}
      <nav aria-label="Main tabs" style={{ margin: '12px 0' }}>
        {ORDER.map((t) => (
          <button
            key={t}
            aria-current={t === tab ? 'page' : undefined}
            onClick={() => setTab(t)}
            style={{ fontWeight: t === tab ? 700 : 400, marginRight: 6 }}
          >
            {LABEL(t)}
          </button>
        ))}
      </nav>

      <div hidden={tab !== 'dashboard'}>
        <h2>Dashboard</h2>
        <Dashboard data={data} />
      </div>

      {CHAT_TABS.map((t) => (
        <div key={t} hidden={t !== tab}>
          <h2>{TAB_LABELS[t]}</h2>
          <ChatPanel
            tab={t}
            host={host}
            vault={vault}
            data={data}
            onChanged={onChanged}
            onEntry={onEntry}
            incoming={incoming[t]}
            onSwitchTab={(to, text) => {
              setIncoming((m) => ({ ...m, [to]: { id: Date.now(), text } }));
              setTab(to);
            }}
          />
          {body(t)}
        </div>
      ))}
    </main>
    {event && <EntryAnimation key={event.id} event={event} onDone={clearEvent} />}
    </>
  );
}
