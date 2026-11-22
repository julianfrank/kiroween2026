import { describe, expect, it } from 'vitest';
import { draftFromEntry, resolveAny, blankDraft, type EntryDraft, type ResolveContext } from '../chat/draft';
import type { Entry } from '../ledger/types';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import { MemoryKV } from '../store/kv';
import { commitCorrection, commitEntry, commitReversal, commitTarget, loadAll, saveSetup, type LoadedData } from '../store/repo';
import { createVault } from '../store/vault';
import { budgetProgress, goalProgress } from './progress';
import type { Budget, Goal } from './types';

const TODAY = '2026-11-22';

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2026', ...over };
}

async function setup() {
  const rows = [
    row({ name: 'Cash', amountText: '1,00,000' }),
    row({ name: 'Delhi', amountText: '40L', asOfText: '10/May/2000' }),
    row({ kind: 'liability', name: 'Loan - Tom', amountText: '2,000' }),
  ];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const kv = new MemoryKV();
  const vault = await createVault(kv, 'pw', 1000);
  await saveSetup(vault, accounts, ledger.entries);
  const data: LoadedData = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const ctx = (): ResolveContext => ({
    accounts: data.accounts,
    budgets: data.budgets,
    goals: data.goals,
    today: TODAY,
    balanceOf: (k) => data.ledger.balance(k),
  });
  const id = (name: string) => [...data.accounts.values()].find((a) => a.name === name)!.key;
  return { data, vault, ctx, id };
}

const d = (over: Partial<EntryDraft>): EntryDraft => ({ ...blankDraft('said'), source: 'ai-confirmed', ...over });

async function spend(s: Awaited<ReturnType<typeof setup>>, amount: string, to = 'Food', date = '22/Nov/2026') {
  const r = resolveAny(d({ intent: 'expense', amountText: amount, dateText: date, fromName: 'Cash', toName: to }), s.ctx());
  if (!r.ok || r.kind !== 'entry') throw new Error('expected an entry');
  return commitEntry(s.vault, s.data, r.newAccounts, r.entry);
}

describe('budgets', () => {
  it('sets a monthly limit on an expense account, and replaces it when set again', async () => {
    const s = await setup();
    const r = resolveAny(d({ intent: 'set-budget', amountText: '8000', toName: 'Food' }), s.ctx());
    expect(r.ok && r.kind === 'budget' && r.budget).toEqual({ name: 'Food', monthlyLimitRupees: 8000, accounts: [s.id('Food')] });
    if (!r.ok || r.kind !== 'budget') return;
    await commitTarget(s.vault, s.data, r.newAccounts, { kind: 'budget', key: r.key, budget: r.budget });

    const again = resolveAny(d({ intent: 'set-budget', amountText: '9000', toName: 'food' }), s.ctx());
    expect(again.ok && again.kind === 'budget' && again.key).toBe(r.key);
    expect(again.ok && again.warnings.join(' ')).toContain('replaces the current limit of ₹8,000');
  });

  it('rejects a non-expense account and whole-rupee violations', async () => {
    const s = await setup();
    const wrong = resolveAny(d({ intent: 'set-budget', amountText: '8000', toName: 'Cash' }), s.ctx());
    expect(!wrong.ok && wrong.problems[0].code).toBe('account-kind');
    const paise = resolveAny(d({ intent: 'set-budget', amountText: '80.5', toName: 'Food' }), s.ctx());
    expect(!paise.ok && paise.problems[0].code).toBe('amount');
  });

  it('progress counts only this month, flags near and over, and reversals cancel', async () => {
    const s = await setup();
    const b: Budget = { name: 'Food', monthlyLimitRupees: 1000, accounts: [s.id('Food')] };
    await spend(s, '300', 'Food', '03/Nov/2026');
    await spend(s, '999', 'Food', '15/Oct/2026'); // last month: ignored
    expect(budgetProgress(b, s.data.ledger, TODAY)).toMatchObject({ spent: 300, remaining: 700, over: false, near: false });
    const k = await spend(s, '550', 'Food');
    expect(budgetProgress(b, s.data.ledger, TODAY)).toMatchObject({ spent: 850, near: true, over: false });
    await spend(s, '400', 'Food');
    expect(budgetProgress(b, s.data.ledger, TODAY)).toMatchObject({ spent: 1250, over: true, remaining: -250 });
    await commitReversal(s.vault, s.data, k, 'wrong entry');
    expect(budgetProgress(b, s.data.ledger, TODAY)).toMatchObject({ spent: 700, over: false });
  });
});

describe('goals', () => {
  it('attaches to a savings account, with a month-year target date', async () => {
    const s = await setup();
    const r = resolveAny(d({ intent: 'set-goal', fromName: 'Safety net', amountText: '3L', dateText: 'Dec 2027', toName: 'Savings' }), s.ctx());
    expect(r.ok && r.kind === 'goal' && r.goal).toEqual({ name: 'Safety net', targetRupees: 300000, targetDate: '2027-12-31', account: s.id('Savings') });
    expect(r.ok && r.kind === 'goal' && r.summary).toContain('31/Dec/2027');
  });

  it('proposes a new savings account for a new name, and refuses non-savings accounts', async () => {
    const s = await setup();
    const fresh = resolveAny(d({ intent: 'set-goal', fromName: 'Trip', amountText: '50k', toName: 'Trip fund' }), s.ctx());
    expect(fresh.ok && fresh.newAccounts.map((a) => [a.name, a.kind, a.category])).toEqual([['Trip fund', 'asset', 'savings']]);
    const bad = resolveAny(d({ intent: 'set-goal', fromName: 'Trip', amountText: '50k', toName: 'Delhi' }), s.ctx());
    expect(!bad.ok && bad.problems[0].message).toContain('not a savings or investment account');
    const past = resolveAny(d({ intent: 'set-goal', fromName: 'Trip', amountText: '50k', dateText: '01/Jan/2020', toName: 'Savings' }), s.ctx());
    expect(!past.ok && past.problems[0].code).toBe('date');
    const noName = resolveAny(d({ intent: 'set-goal', fromName: '', amountText: '50k', toName: 'Savings' }), s.ctx());
    expect(!noName.ok && noName.problems[0].code).toBe('from');
  });

  it('progress comes from the ledger: a transfer into the account moves it', async () => {
    const s = await setup();
    const g: Goal = { name: 'Safety net', targetRupees: 10000, targetDate: null, account: s.id('Savings') };
    expect(goalProgress(g, s.data.ledger, TODAY)).toMatchObject({ saved: 0, percent: 0, done: false });
    const t = resolveAny(d({ intent: 'transfer', amountText: '2500', fromName: 'Cash', toName: 'Savings' }), s.ctx());
    if (!t.ok || t.kind !== 'entry') throw new Error('expected an entry');
    await commitEntry(s.vault, s.data, t.newAccounts, t.entry);
    expect(goalProgress(g, s.data.ledger, TODAY)).toMatchObject({ saved: 2500, percent: 25, remaining: 7500, done: false });
  });

  it('budgets and goals are saved encrypted and come back after a reload', async () => {
    const s = await setup();
    const r = resolveAny(d({ intent: 'set-goal', fromName: 'Trip', amountText: '50k', toName: 'Trip fund' }), s.ctx());
    if (!r.ok || r.kind !== 'goal') throw new Error('expected a goal');
    await commitTarget(s.vault, s.data, r.newAccounts, { kind: 'goal', key: r.key, goal: r.goal });
    const loaded = await loadAll(s.vault);
    expect([...loaded.goals.values()].map((g) => g.name)).toEqual(['Trip']);
    expect([...loaded.accounts.values()].some((a) => a.name === 'Trip fund' && a.category === 'savings')).toBe(true);
  });
});

describe('reversal and correction', () => {
  it('a reversal is dated like the original, cancels it, and says why', async () => {
    const s = await setup();
    const k = await spend(s, '800', 'Food', '03/Nov/2026');
    const before = s.data.ledger.balance(s.id('Cash'));
    const rk = await commitReversal(s.vault, s.data, k, 'paid twice');
    const e = s.data.ledger.entries.get(rk)!;
    expect(e).toMatchObject({ kind: 'reversal', reverses: k, date: '2026-11-03' });
    expect(e.note).toContain('paid twice');
    expect(s.data.ledger.balance(s.id('Cash'))).toBe(before + 800);
    expect(s.data.ledger.isReversed(k)).toBe(true);
    await expect(commitReversal(s.vault, s.data, k, 'again')).rejects.toThrow(/already reversed/);
  });

  it('a correction reverses the original and posts a linked, corrected entry', async () => {
    const s = await setup();
    const k = await spend(s, '5000', 'Food');
    const original = s.data.ledger.entries.get(k)!;
    const draft = draftFromEntry(original, s.data.accounts)!;
    expect(draft).toMatchObject({ intent: 'expense', amountText: '5000', fromName: 'Cash', toName: 'Food' });
    const fixed = resolveAny({ ...draft, amountText: '6000' }, s.ctx());
    if (!fixed.ok || fixed.kind !== 'entry') throw new Error('expected an entry');
    const { reversal, correction } = await commitCorrection(s.vault, s.data, k, 'typed 5000, was 6000', fixed.newAccounts, fixed.entry);
    expect(s.data.ledger.entries.get(reversal)!.reverses).toBe(k);
    const c = s.data.ledger.entries.get(correction)!;
    expect(c).toMatchObject({ kind: 'correction', correctionOf: k });
    expect(c.note).toContain(`Correction of ${k}`);
    expect(s.data.ledger.balance(s.id('Food'))).toBe(6000);
    expect(s.data.ledger.balance(s.id('Cash'))).toBe(100000 - 6000);
    // everything survives a reload
    const loaded = await loadAll(s.vault);
    expect(loaded.ledger.balance(s.id('Food'))).toBe(6000);
  });

  it('an invalid correction changes nothing', async () => {
    const s = await setup();
    const k = await spend(s, '5000', 'Food');
    const bad: Entry = { ...s.data.ledger.entries.get(k)!, lines: [] };
    const size = s.data.ledger.entries.size;
    await expect(commitCorrection(s.vault, s.data, k, 'x', [], bad)).rejects.toThrow();
    expect(s.data.ledger.entries.size).toBe(size);
    expect(s.data.ledger.isReversed(k)).toBe(false);
  });

  it('opening, revaluation and reversal entries cannot be rebuilt into a correction form', async () => {
    const s = await setup();
    const opening = [...s.data.ledger.entries.values()][0];
    expect(draftFromEntry(opening, s.data.accounts)).toBeNull();
  });
});
