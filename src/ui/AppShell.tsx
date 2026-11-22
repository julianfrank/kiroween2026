import { useState } from 'react';
import type { PromptHost } from '../chat/proposal';
import { CHAT_TABS, TAB_LABELS, type ChatTabId } from '../chat/intents';
import type { LoadedData } from '../store/repo';
import type { Vault } from '../store/vault';
import { ChatPanel, type Incoming } from './ChatPanel';
import { AccountList, BudgetsList, DailyList, DashboardTab, GoalsList } from './lists';

type TabId = 'dashboard' | ChatTabId;
const ORDER: TabId[] = ['dashboard', 'assets', 'liabilities', 'goals', 'budgets', 'daily'];
const LABEL = (t: TabId) => (t === 'dashboard' ? 'Dashboard' : TAB_LABELS[t]);

export function AppShell({
  data,
  vault,
  host,
  onChanged,
}: {
  data: LoadedData;
  vault: Vault;
  host: PromptHost;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [incoming, setIncoming] = useState<Partial<Record<ChatTabId, Incoming>>>({});

  const body = (t: ChatTabId) => {
    switch (t) {
      case 'assets':
        return <AccountList data={data} kind="asset" />;
      case 'liabilities':
        return <AccountList data={data} kind="liability" />;
      case 'goals':
        return <GoalsList data={data} />;
      case 'budgets':
        return <BudgetsList data={data} />;
      case 'daily':
        return <DailyList data={data} vault={vault} onChanged={onChanged} />;
    }
  };

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Scary Money Manager</h1>
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
        <DashboardTab data={data} />
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
  );
}
