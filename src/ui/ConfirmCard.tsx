import { useState } from 'react';
import { formatDate } from '../dates/dates';
import { resolveAny, type EntryDraft, type ResolveContext } from '../chat/draft';
import { INTENTS, TAB_SCOPES, type ChatTabId } from '../chat/intents';
import { formatRupees } from '../money/money';

/** The Confirm Card and the manual form are the same editable card (design: manual form is pre-filled). */
export function ConfirmCard({
  tab,
  initial,
  questions,
  ctx,
  onConfirm,
  onCancel,
  askReason,
  title,
}: {
  tab: ChatTabId;
  initial: EntryDraft;
  questions: string[];
  ctx: ResolveContext;
  onConfirm: (draft: EntryDraft, reason: string) => Promise<void>;
  onCancel: () => void;
  /** When set, the user must say why (used for corrections). */
  askReason?: boolean;
  title?: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const result = resolveAny(draft, ctx);
  const intent = draft.intent ? INTENTS[draft.intent] : null;
  const accountNames = (kind: string | null) =>
    [...ctx.accounts.values()].filter((a) => a.kind === kind && !a.system).map((a) => a.name);
  const needReason = askReason && reason.trim() === '';

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      await onConfirm(draft, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  // A correction can be of an entry from another tab's scope, so keep its own intent in the list.
  const base = TAB_SCOPES[tab];
  const intents = draft.intent && !base.includes(draft.intent) ? [...base, draft.intent] : base;

  return (
    <div style={{ border: '2px solid var(--border)', borderRadius: 8, padding: 12, margin: '8px 0' }}>
      <strong>{title ?? (result.ok ? 'Please confirm' : 'I need a few details')}</strong>
      {questions.map((q) => (
        <div key={q}>{q}</div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 6, margin: '8px 0' }}>
        <label htmlFor="cc-intent">What happened</label>
        <select
          id="cc-intent"
          value={draft.intent ?? ''}
          onChange={(e) => set({ intent: (e.target.value || null) as EntryDraft['intent'] })}
        >
          <option value="">Choose…</option>
          {intents.map((id) => (
            <option key={id} value={id}>
              {INTENTS[id].label}
            </option>
          ))}
        </select>

        <label htmlFor="cc-amount">{intent?.amountLabel ?? 'Amount (₹)'}</label>
        <input id="cc-amount" value={draft.amountText} inputMode="decimal" onChange={(e) => set({ amountText: e.target.value })} />

        {(!intent?.target || intent.dateLabel) && (
          <>
            <label htmlFor="cc-date">{intent?.dateLabel ?? 'Date (IST)'}</label>
            <input
              id="cc-date"
              value={draft.dateText}
              placeholder={intent?.dateLabel ? 'DD/MMM/YYYY or Dec 2027' : `today, yesterday or DD/MMM/YYYY (${formatDate(ctx.today)})`}
              onChange={(e) => set({ dateText: e.target.value })}
            />
          </>
        )}

        {intent?.nameLabel && (
          <>
            <label htmlFor="cc-name">{intent.nameLabel}</label>
            <input id="cc-name" value={draft.fromName} onChange={(e) => set({ fromName: e.target.value })} />
          </>
        )}
        {intent?.fromKind && (
          <>
            <label htmlFor="cc-from">{intent.fromLabel}</label>
            <input id="cc-from" list="cc-from-list" value={draft.fromName} onChange={(e) => set({ fromName: e.target.value })} />
            <datalist id="cc-from-list">
              {accountNames(intent.fromKind).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </>
        )}
        {intent && (
          <>
            <label htmlFor="cc-to">{intent.toLabel}</label>
            <input id="cc-to" list="cc-to-list" value={draft.toName} onChange={(e) => set({ toName: e.target.value })} />
            <datalist id="cc-to-list">
              {accountNames(intent.toKind).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </>
        )}
        {askReason && (
          <>
            <label htmlFor="cc-reason">Why is this being corrected?</label>
            <input id="cc-reason" value={reason} placeholder="e.g. typed 5000, was 6000" onChange={(e) => setReason(e.target.value)} />
          </>
        )}
      </div>

      {result.ok ? (
        <>
          {result.kind === 'entry' ? (
            <div>
              {result.lines.map((l) => (
                <div key={l.side}>
                  {l.side} <b>{l.accountName}</b> {formatRupees(l.amount)}
                </div>
              ))}
              <div>
                Dated <b>{formatDate(result.entry.date)}</b>
              </div>
              <div style={{ opacity: 0.8 }}>Note: {result.entry.note}</div>
            </div>
          ) : (
            <div>
              <b>{result.summary}</b>
            </div>
          )}
          {result.warnings.map((w) => (
            <div key={w} role="status" style={{ color: 'var(--warn)' }}>
              {w}
            </div>
          ))}
        </>
      ) : (
        result.problems.map((p) => (
          <div key={p.message} role="alert" style={{ color: 'var(--bad)' }}>
            {p.message}
          </div>
        ))
      )}

      <div style={{ marginTop: 8 }}>
        <button disabled={!result.ok || saving || needReason} onClick={confirm}>
          {saving ? 'Saving…' : 'Confirm'}
        </button>{' '}
        <button disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <div role="alert">{error}</div>}
    </div>
  );
}
