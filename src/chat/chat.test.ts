import { describe, expect, it } from 'vitest';
import { AiHost } from '../ai/host';
import type { PromptOptions, SessionLike } from '../ai/readiness';
import { resolveDatePhrase } from '../dates/resolve';
import { MemoryKV } from '../store/kv';
import { commitEntry, loadAll, saveSetup } from '../store/repo';
import { createVault } from '../store/vault';
import { buildSetup, evaluateDraft, type DraftRow } from '../setup/setup';
import { blankDraft, resolveDraft, type EntryDraft, type ResolveContext } from './draft';
import { PROPOSAL_SCHEMA, proposeEntry, type PromptHost } from './proposal';

const TODAY = '2026-11-22'; // a Sunday

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2026', ...over };
}

function fixture() {
  const rows = [
    row({ name: 'Cash', amountText: '10,000' }),
    row({ name: 'House', amountText: '40L', asOfText: '10/May/2000' }),
    row({ kind: 'liability', name: 'Loan - Tom', amountText: '2,000' }),
  ];
  const ev = evaluateDraft(rows, '4008000', TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const ctx: ResolveContext = { accounts, today: TODAY, balanceOf: (k) => ledger.balance(k) };
  return { accounts, ledger, ctx };
}

const draft = (over: Partial<EntryDraft>): EntryDraft => ({ ...blankDraft('said'), source: 'ai-confirmed', ...over });

describe('date resolver', () => {
  const r = (t: string) => resolveDatePhrase(t, TODAY);
  it('understands relative and absolute phrases', () => {
    expect(r('today')).toBe('2026-11-22');
    expect(r('yesterday')).toBe('2026-11-21');
    expect(r('3 days ago')).toBe('2026-11-19');
    expect(r('two weeks ago')).toBe('2026-11-08');
    expect(r('last friday')).toBe('2026-11-20');
    expect(r('friday')).toBe('2026-11-20');
    expect(r('last sunday')).toBe('2026-11-15');
    expect(r('3 Nov')).toBe('2026-11-03');
    expect(r('25 Dec')).toBe('2025-12-25'); // not given a year and still ahead: the latest past one
    expect(r('on 22/Nov/2026')).toBe('2026-11-22');
    expect(r('Nov 3rd, 2024')).toBe('2024-11-03');
    expect(r('tomorrow')).toBe('2026-11-23');
  });
  it('returns null for what it cannot read', () => {
    expect(r('')).toBeNull();
    expect(r('whenever')).toBeNull();
    expect(r('31 Feb')).toBeNull();
  });
});

describe('resolveDraft (the app does the math)', () => {
  it('borrow: debit the cash account, credit the lender, and write a clear note', () => {
    const { ctx } = fixture();
    const r = resolveDraft(draft({ intent: 'borrow', amountText: '5000', fromName: 'Tom', toName: 'Cash', userText: "I've taken a Loan of Rs.5000 from Tom" }), ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.newAccounts).toHaveLength(0); // "Tom" matched the existing "Loan - Tom"
    const debit = r.entry.lines.reduce((s, l) => s + l.debitRupees, 0);
    const credit = r.entry.lines.reduce((s, l) => s + l.creditRupees, 0);
    expect(debit).toBe(5000);
    expect(credit).toBe(5000);
    expect(r.entry.note).toContain('Borrowed ₹5,000');
    expect(r.entry.note).toContain('Loan - Tom');
    expect(r.entry.note).toContain("You said: \"I've taken a Loan of Rs.5000 from Tom\"");
    expect(r.lines[0]).toMatchObject({ side: 'Debit', accountName: 'Cash', amount: 5000 });
  });

  it('proposes a new account when the name is unknown, and flags it', () => {
    const { ctx } = fixture();
    const r = resolveDraft(draft({ intent: 'borrow', amountText: '7000', fromName: 'Loan - Meera', toName: 'Cash' }), ctx);
    expect(r.ok && r.newAccounts.map((a) => [a.name, a.kind])).toEqual([['Loan - Meera', 'liability']]);
    expect(r.ok && r.warnings.join(' ')).toContain('new liability account');
  });

  it('income, expense, transfer', () => {
    const { ctx } = fixture();
    expect(resolveDraft(draft({ intent: 'income', amountText: '50k', fromName: 'Salary', toName: 'Cash' }), ctx).ok).toBe(true);
    const e = resolveDraft(draft({ intent: 'expense', amountText: '800', dateText: 'yesterday', fromName: 'Cash', toName: 'Food' }), ctx);
    expect(e.ok && e.entry.date).toBe('2026-11-21');
    expect(resolveDraft(draft({ intent: 'transfer', amountText: '1000', fromName: 'Cash', toName: 'Savings' }), ctx).ok).toBe(true);
  });

  it('rejects an account of the wrong kind, the same account twice, paise, bad dates', () => {
    const { ctx } = fixture();
    const kind = resolveDraft(draft({ intent: 'expense', amountText: '800', fromName: 'Food', toName: 'Rent' }), ctx);
    expect(!kind.ok && kind.problems[0].code).toBe('account-kind');
    const same = resolveDraft(draft({ intent: 'transfer', amountText: '5', fromName: 'Cash', toName: 'cash' }), ctx);
    expect(!same.ok && same.problems[0].code).toBe('same-account');
    const paise = resolveDraft(draft({ intent: 'expense', amountText: '50.5', fromName: 'Cash', toName: 'Food' }), ctx);
    expect(!paise.ok && paise.problems[0].message).toContain('no paise');
    const date = resolveDraft(draft({ intent: 'expense', amountText: '5', dateText: 'someday', fromName: 'Cash', toName: 'Food' }), ctx);
    expect(!date.ok && date.problems[0].code).toBe('date');
  });

  it('flags a future date but allows it', () => {
    const { ctx } = fixture();
    const r = resolveDraft(draft({ intent: 'expense', amountText: '5', dateText: 'tomorrow', fromName: 'Cash', toName: 'Food' }), ctx);
    expect(r.ok && r.warnings).toContain('This date is in the future.');
  });

  it('revaluation is booked as profit (Valuation Gain) or loss (Valuation Loss)', () => {
    const { ctx, accounts } = fixture();
    const name = (k: string) => accounts.get(k)!.name;
    const up = resolveDraft(draft({ intent: 'revalue', amountText: '45L', toName: 'House' }), ctx);
    expect(up.ok && up.entry.kind).toBe('revaluation');
    expect(up.ok && up.lines.map((l) => [l.side, l.accountName, l.amount])).toEqual([
      ['Debit', 'House', 500000],
      ['Credit', 'Valuation Gain', 500000],
    ]);
    const down = resolveDraft(draft({ intent: 'revalue', amountText: '39L', toName: 'House' }), ctx);
    expect(down.ok && down.lines.map((l) => [l.side, l.accountName, l.amount])).toEqual([
      ['Debit', 'Valuation Loss', 100000],
      ['Credit', 'House', 100000],
    ]);
    const same = resolveDraft(draft({ intent: 'revalue', amountText: '40L', toName: 'House' }), ctx);
    expect(!same.ok && same.problems[0].code).toBe('no-change');
    void name;
  });
});

function scripted(...replies: Array<string | Error>): PromptHost & { calls: Array<{ input: string; options?: PromptOptions }> } {
  const calls: Array<{ input: string; options?: PromptOptions }> = [];
  return {
    calls,
    async prompt(input, options) {
      calls.push({ input, options });
      const next = replies[Math.min(calls.length - 1, replies.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
const reply = (o: object) => JSON.stringify(o);
const borrow = { intent: 'borrow', amount: '5000', date: '', fromAccount: 'Tom', toAccount: 'Cash' };

function args(tab: 'liabilities' | 'daily' | 'budgets', message: string) {
  const { ctx } = fixture();
  return { tab, message, ...ctx };
}

describe('proposeEntry', () => {
  it('returns a Confirm Card draft for a valid proposal, and sends the schema, date and message', async () => {
    const host = scripted(reply(borrow));
    const out = await proposeEntry(host, args('liabilities', "I've taken a Loan of Rs.5000 from Tom"));
    expect(out.type).toBe('confirm');
    expect(host.calls).toHaveLength(1);
    expect(host.calls[0].options?.responseConstraint).toBe(PROPOSAL_SCHEMA);
    expect(host.calls[0].input).toContain('22/Nov/2026');
    expect(host.calls[0].input).toContain('Loan of Rs.5000 from Tom');
    expect(host.calls[0].input).toContain('Loan - Tom'); // existing account names are given to the model
  });

  it('retries once on invalid JSON, with the reason in the second prompt', async () => {
    const host = scripted('not json', reply(borrow));
    const out = await proposeEntry(host, args('liabilities', 'loan from tom 5000'));
    expect(out.type).toBe('confirm');
    expect(host.calls).toHaveLength(2);
    expect(host.calls[1].input).toContain('rejected because the reply was not valid JSON');
  });

  it('after two bad replies, asks the user and offers a form that keeps their message', async () => {
    const host = scripted('nope', '{"intent":"borrow"}');
    const out = await proposeEntry(host, args('liabilities', 'loan from tom'));
    expect(host.calls).toHaveLength(2);
    expect(out.type).toBe('needs-input');
    if (out.type === 'needs-input') {
      expect(out.draft.userText).toBe('loan from tom');
      expect(out.draft.source).toBe('manual-form');
      expect(out.problems[0].message).toContain("could not read the AI's answer");
    }
  });

  it('asks a clarifying question (no retry) when the user gave no amount, keeping what was understood', async () => {
    const host = scripted(reply({ ...borrow, amount: '' }));
    const out = await proposeEntry(host, args('liabilities', 'borrowed from tom'));
    expect(host.calls).toHaveLength(1);
    expect(out.type).toBe('needs-input');
    if (out.type === 'needs-input') {
      expect(out.problems.some((p) => p.code === 'amount')).toBe(true);
      expect(out.draft).toMatchObject({ intent: 'borrow', fromName: 'Tom', toName: 'Cash' });
    }
  });

  it('redirects to the right tab when the message belongs elsewhere', async () => {
    const host = scripted(reply({ intent: 'expense', amount: '800', date: '', fromAccount: 'Cash', toAccount: 'Food' }));
    const out = await proposeEntry(host, args('liabilities', 'paid 800 for groceries'));
    expect(out).toMatchObject({ type: 'redirect', tab: 'daily' });
  });

  it('retries once when the model names an account of the wrong kind', async () => {
    const host = scripted(
      reply({ intent: 'expense', amount: '800', date: '', fromAccount: 'Food', toAccount: 'Rent' }),
      reply({ intent: 'expense', amount: '800', date: '', fromAccount: 'Cash', toAccount: 'Food' }),
    );
    const out = await proposeEntry(host, args('daily', 'paid 800 for food'));
    expect(host.calls).toHaveLength(2);
    expect(host.calls[1].input).toContain('expense account');
    expect(out.type).toBe('confirm');
  });

  it('handles "other", an unavailable chat tab, and a failing session', async () => {
    const other = await proposeEntry(scripted(reply({ intent: 'other', amount: '', date: '', fromAccount: '', toAccount: '' })), args('daily', 'hello'));
    expect(other.type).toBe('needs-input');
    const budgets = await proposeEntry(scripted(reply(borrow)), args('budgets', 'x'));
    expect(budgets).toMatchObject({ type: 'redirect', tab: 'liabilities' });
    const err = await proposeEntry(scripted(new Error('session destroyed')), args('daily', 'x'));
    expect(err).toEqual({ type: 'error', message: 'session destroyed' });
  });
});

function fakeSession(usage = 0, window = 100): SessionLike & { destroyed: boolean; seen: string[] } {
  return {
    destroyed: false,
    seen: [],
    contextUsage: usage,
    contextWindow: window,
    async prompt(input: string) {
      if (this.destroyed) throw Object.assign(new Error('destroyed'), { name: 'InvalidStateError' });
      this.seen.push(input);
      return 'ok';
    },
    destroy() {
      this.destroyed = true;
    },
  };
}

describe('AiHost', () => {
  it('rebuilds the session when the context passes 80%, destroying the old one', async () => {
    const full = fakeSession(85);
    const fresh = fakeSession(0);
    const host = new AiHost(async () => fresh);
    host.adopt(full);
    await host.prompt('hi');
    expect(full.destroyed).toBe(true);
    expect(fresh.seen).toEqual(['hi']);
  });

  it('keeps the session below the threshold', async () => {
    const s = fakeSession(50);
    const host = new AiHost(async () => fakeSession());
    host.adopt(s);
    await host.prompt('hi');
    expect(s.destroyed).toBe(false);
  });

  it('after destroy() (lock, close, import) prompting fails and the old session is destroyed', async () => {
    const s = fakeSession();
    const host = new AiHost(async () => fakeSession());
    host.adopt(s);
    host.destroy();
    expect(s.destroyed).toBe(true);
    await expect(host.prompt('hi')).rejects.toThrow('not ready');
    await expect(s.prompt('hi')).rejects.toMatchObject({ name: 'InvalidStateError' });
  });
});

describe('commitEntry', () => {
  async function setup() {
    const { accounts, ledger } = fixture();
    const kv = new MemoryKV();
    const vault = await createVault(kv, 'pw', 1000);
    await saveSetup(vault, accounts, ledger.entries);
    return { kv, vault, data: { accounts, ledger } };
  }

  it('saves a confirmed entry and a new account encrypted, and they survive a reload', async () => {
    const { kv, vault, data } = await setup();
    const r = resolveDraft(draft({ intent: 'borrow', amountText: '7000', fromName: 'Loan - Meera', toName: 'Cash', userText: 'from Meera' }), {
      accounts: data.accounts, today: TODAY, balanceOf: (k) => data.ledger.balance(k),
    });
    if (!r.ok) throw new Error('should resolve');
    const key = await commitEntry(vault, data, r.newAccounts, r.entry);
    expect(key).toBe('txn:2026-11-22:0001');
    expect(data.ledger.entries.has(key)).toBe(true);
    expect([...kv.data.entries()].flat().join('\n')).not.toContain('Meera');

    const loaded = await loadAll(vault);
    expect(loaded.ledger.entries.get(key)?.note).toContain('Meera');
    expect([...loaded.accounts.values()].some((a) => a.name === 'Loan - Meera')).toBe(true);
    expect(loaded.ledger.netWorth()).toBe(data.ledger.netWorth());
  });

  it('rolls back new accounts and leaves the ledger alone when the entry is refused', async () => {
    const { vault, data } = await setup();
    const before = data.accounts.size;
    const bad = { date: 'nope', note: 'x', lines: [], kind: 'normal' as const, reverses: null, correctionOf: null, source: 'manual-form' as const };
    const acct = { key: 'acct:zzzz', name: 'Temp', kind: 'asset' as const, asOfDate: TODAY };
    await expect(commitEntry(vault, data, [acct], bad)).rejects.toThrow();
    expect(data.accounts.size).toBe(before);
  });
});
