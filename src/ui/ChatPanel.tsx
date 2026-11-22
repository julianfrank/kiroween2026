import { useEffect, useRef, useState } from 'react';
import type { PromptHost } from '../chat/proposal';
import { proposeEntry, type Outcome } from '../chat/proposal';
import { resolveDraft, type EntryDraft } from '../chat/draft';
import { TAB_LABELS, TAB_SCOPES, type ChatTabId } from '../chat/intents';
import { formatDate, todayIso } from '../dates/dates';
import { formatRupees } from '../money/money';
import { commitEntry, type LoadedData } from '../store/repo';
import type { Vault } from '../store/vault';
import { ConfirmCard } from './ConfirmCard';

type Item =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'info'; text: string }
  | { id: number; kind: 'card'; draft: EntryDraft; questions: string[]; state: 'open' | 'saved' | 'cancelled'; savedText?: string }
  | { id: number; kind: 'redirect'; tab: ChatTabId; text: string; state: 'open' | 'moved' };

export interface Incoming {
  id: number;
  text: string;
}

let nextId = 1;

export function ChatPanel({
  tab,
  host,
  vault,
  data,
  onChanged,
  onSwitchTab,
  incoming,
}: {
  tab: ChatTabId;
  host: PromptHost;
  vault: Vault;
  data: LoadedData;
  onChanged: () => void;
  onSwitchTab: (tab: ChatTabId, text: string) => void;
  incoming?: Incoming;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(0);

  const push = (item: Item) => setItems((xs) => [...xs, item]);
  const patch = (id: number, p: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.id === id ? ({ ...x, ...p } as Item) : x)));

  const ctx = () => ({
    accounts: data.accounts,
    today: todayIso(),
    balanceOf: (key: string) => data.ledger.balance(key),
  });

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    push({ id: nextId++, kind: 'user', text: m });
    if (TAB_SCOPES[tab].length === 0) {
      push({ id: nextId++, kind: 'info', text: `Chat in ${TAB_LABELS[tab]} is not available yet.` });
      return;
    }
    setBusy(true);
    const outcome: Outcome = await proposeEntry(host, { tab, message: m, ...ctx() });
    setBusy(false);
    switch (outcome.type) {
      case 'confirm':
        push({ id: nextId++, kind: 'card', draft: outcome.draft, questions: [], state: 'open' });
        break;
      case 'needs-input':
        push({ id: nextId++, kind: 'card', draft: outcome.draft, questions: outcome.problems.map((p) => p.message), state: 'open' });
        break;
      case 'redirect':
        push({
          id: nextId++,
          kind: 'redirect',
          tab: outcome.tab,
          state: 'open',
          text: `That looks like a ${TAB_LABELS[outcome.tab]} entry. Switch there?`,
        });
        break;
      case 'error':
        push({ id: nextId++, kind: 'info', text: `Something went wrong: ${outcome.message}` });
    }
  }

  useEffect(() => {
    if (incoming && incoming.id !== handled.current) {
      handled.current = incoming.id;
      void send(incoming.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  async function confirm(item: Extract<Item, { kind: 'card' }>, draft: EntryDraft) {
    const r = resolveDraft(draft, ctx());
    if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' '));
    const key = await commitEntry(vault, data, r.newAccounts, r.entry);
    patch(item.id, { state: 'saved', savedText: `Saved ${formatDate(r.entry.date)}: ${r.entry.note} (${key})` });
    onChanged();
  }

  const lastMessage = [...items].reverse().find((i) => i.kind === 'user') as { text: string } | undefined;

  return (
    <section aria-label={`${TAB_LABELS[tab]} chat`} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
      <div style={{ minHeight: 80 }}>
        {items.map((it) => {
          if (it.kind === 'user') return <div key={it.id}><b>You:</b> {it.text}</div>;
          if (it.kind === 'info') return <div key={it.id}>{it.text}</div>;
          if (it.kind === 'redirect') {
            return (
              <div key={it.id}>
                {it.text}{' '}
                {it.state === 'open' ? (
                  <button
                    onClick={() => {
                      patch(it.id, { state: 'moved' });
                      onSwitchTab(it.tab, lastMessage?.text ?? '');
                    }}
                  >
                    Switch to {TAB_LABELS[it.tab]}
                  </button>
                ) : (
                  <i>(moved)</i>
                )}
              </div>
            );
          }
          if (it.state === 'saved') return <div key={it.id}>✔ {it.savedText}</div>;
          if (it.state === 'cancelled') return <div key={it.id}><i>Cancelled.</i></div>;
          return (
            <ConfirmCard
              key={it.id}
              tab={tab}
              initial={it.draft}
              questions={it.questions}
              ctx={ctx()}
              onConfirm={(d) => confirm(it, d)}
              onCancel={() => patch(it.id, { state: 'cancelled' })}
            />
          );
        })}
        {busy && <div><i>Thinking…</i></div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text;
          setText('');
          void send(t);
        }}
      >
        <input
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            tab === 'liabilities'
              ? "I've taken a loan of Rs.5000 from Tom"
              : tab === 'daily'
                ? 'Paid Rs.800 for groceries yesterday'
                : 'Type what happened'
          }
          style={{ width: '70%' }}
        />{' '}
        <button type="submit" disabled={busy}>Send</button>
      </form>
      <div style={{ opacity: 0.6 }}>Net worth now {formatRupees(data.ledger.netWorth())}</div>
    </section>
  );
}
