import { describe, expect, it } from 'vitest';
import { MemoryKV } from '../store/kv';
import { commitEntry, commitRename, loadAll, saveSetup, type LoadedData } from '../store/repo';
import { createVault } from '../store/vault';
import { buildSetup, differenceEquity, evaluateDraft, type DraftRow } from '../setup/setup';
import { blankDraft, resolveAny, type EntryDraft, type ResolveContext } from './draft';
import { proposeEntry, type PromptHost } from './proposal';

const TODAY = '2026-11-22';

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2020', ...over };
}

async function world() {
  const rows = [row({ name: 'HDFC Bank', amountText: '30L' }), row({ name: 'Delhi', amountText: '30cr' })];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
  const kv = new MemoryKV();
  const vault = await createVault(kv, 'pw', 1000);
  await saveSetup(vault, accounts, ledger.entries);
  const data: LoadedData = { accounts, ledger, budgets: new Map(), goals: new Map() };
  const ctx = (): ResolveContext => ({ accounts: data.accounts, today: TODAY, balanceOf: (k) => data.ledger.balance(k) });
  const find = (name: string) => [...data.accounts.values()].find((a) => a.name === name)!;
  return { data, vault, ctx, find };
}

const d = (over: Partial<EntryDraft>): EntryDraft => ({ ...blankDraft('said'), source: 'ai-confirmed', ...over });

describe('a home loan is never an asset (the -100 crore bug)', () => {
  it('refuses a transfer out of an account that does not exist, and points to "Loan taken"', async () => {
    const w = await world();
    const r = resolveAny(d({ intent: 'transfer', amountText: '100cr', fromName: 'Dubakur Bank - Home Loan', toName: 'Chennai' }), w.ctx());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems[0].code).toBe('account-kind');
    expect(r.problems[0].message).toContain('sounds like a loan');
    expect(r.problems[0].message).toContain('Loan taken');
  });

  it('refuses any new asset that is named like a loan, and any money leaving an unknown account', async () => {
    const w = await world();
    const loanAsset = resolveAny(d({ intent: 'transfer', amountText: '5000', fromName: 'HDFC Bank', toName: 'Car loan' }), w.ctx());
    expect(!loanAsset.ok && loanAsset.problems[0].message).toContain('sounds like a loan');
    const unknown = resolveAny(d({ intent: 'expense', amountText: '500', fromName: 'Wallet', toName: 'Food' }), w.ctx());
    expect(!unknown.ok && unknown.problems[0].message).toContain('not one of your accounts yet');
  });

  it('pointing a transfer or expense at an existing loan suggests the loan entries', async () => {
    const w = await world();
    const borrow = resolveAny(d({ intent: 'borrow', amountText: '100cr', fromName: 'Dubakur Bank - Home Loan', toName: 'Chennai', dateText: '10/Jul/2025' }), w.ctx());
    if (!borrow.ok || borrow.kind !== 'entry') throw new Error('expected an entry');
    await commitEntry(w.vault, w.data, borrow.newAccounts, borrow.entry);
    const misuse = resolveAny(d({ intent: 'transfer', amountText: '1000', fromName: 'HDFC Bank', toName: 'Dubakur Bank - Home Loan' }), w.ctx());
    expect(!misuse.ok && misuse.problems[0].message).toContain('Loan taken');
  });

  it('repaying a loan that does not exist is refused instead of creating a negative liability', async () => {
    const w = await world();
    const r = resolveAny(d({ intent: 'repay', amountText: '5000', fromName: 'HDFC Bank', toName: 'Mystery Loan' }), w.ctx());
    expect(!r.ok && r.problems[0].message).toContain('There is no loan named "Mystery Loan"');
  });

  it('"Loan taken" books the loan as a liability that goes UP, and the property as an asset', async () => {
    const w = await world();
    const before = w.data.ledger.netWorth();
    const r = resolveAny(d({ intent: 'borrow', amountText: '100cr', fromName: 'Dubakur Bank - Home Loan', toName: 'Chennai', dateText: '10/Jul/2025' }), w.ctx());
    if (!r.ok || r.kind !== 'entry') throw new Error('expected an entry');
    expect(r.newAccounts.map((a) => [a.name, a.kind])).toEqual([['Chennai', 'asset'], ['Dubakur Bank - Home Loan', 'liability']]);
    expect(r.lines.map((l) => [l.side, l.accountName, l.amount])).toEqual([
      ['Debit', 'Chennai', 1_000_000_000],
      ['Credit', 'Dubakur Bank - Home Loan', 1_000_000_000],
    ]);
    await commitEntry(w.vault, w.data, r.newAccounts, r.entry);
    expect(w.data.ledger.balance(w.find('Dubakur Bank - Home Loan').key)).toBe(1_000_000_000); // liability went up
    expect(w.data.ledger.balance(w.find('Chennai').key)).toBe(1_000_000_000);
    expect(w.data.ledger.netWorth()).toBe(before); // an asset bought with a loan leaves net worth unchanged
    expect(w.find('Chennai').asOfDate).toBe('2025-07-10');
  });

  it('warns when a payment leaves an account below zero', async () => {
    const w = await world();
    const r = resolveAny(d({ intent: 'expense', amountText: '40L', fromName: 'HDFC Bank', toName: 'Food' }), w.ctx());
    expect(r.ok && r.warnings.join(' ')).toContain('This leaves HDFC Bank at -₹10,00,000');
  });
});

function scripted(...replies: object[]): PromptHost & { calls: number } {
  const h = {
    calls: 0,
    async prompt() {
      return JSON.stringify(replies[Math.min(h.calls++, replies.length - 1)]);
    },
  };
  return h;
}

describe('when the model makes the same mistake', () => {
  const asTransfer = { intent: 'transfer', amount: '100cr', date: '10/Jul/2025', fromAccount: 'Dubakur Bank - Home Loan', toAccount: 'Chennai' };
  const asBorrow = { ...asTransfer, intent: 'borrow' };

  it('retries once with the reason and ends on the loan entry', async () => {
    const w = await world();
    const host = scripted(asTransfer, asBorrow);
    const out = await proposeEntry(host, { tab: 'liabilities', message: 'I took a 100cr home loan from Dubakur Bank for the Chennai flat', ...w.ctx() });
    expect(host.calls).toBe(2);
    expect(out.type).toBe('confirm');
  });

  it('never offers the bad transfer to confirm, even if it keeps insisting', async () => {
    const w = await world();
    const out = await proposeEntry(scripted(asTransfer), { tab: 'daily', message: 'home loan 100cr for Chennai', ...w.ctx() });
    expect(out.type).toBe('needs-input');
    if (out.type === 'needs-input') expect(out.problems[0].message).toContain('sounds like a loan');
  });
});

describe('the real data that went wrong', () => {
  it('an existing asset that is named like a loan can no longer be used for entries', async () => {
    const rows = [row({ name: 'HDFC Bank', amountText: '30L' }), row({ name: 'Dubakur Bank - Home Loan', amountText: '1cr' })]; // made as an asset by mistake
    const first = evaluateDraft(rows, '', TODAY);
    const ev = evaluateDraft(rows, String(differenceEquity(first.assets, first.liabilities)), TODAY);
    const { accounts, ledger } = buildSetup(ev.lines, ev.equity, TODAY);
    const ctx: ResolveContext = { accounts, today: TODAY, balanceOf: (k) => ledger.balance(k) };
    const r = resolveAny(d({ intent: 'transfer', amountText: '1cr', fromName: 'Dubakur Bank - Home Loan', toName: 'HDFC Bank' }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems[0].code).toBe('account-kind');
      expect(r.problems[0].message).toContain('sounds like a loan');
      expect(r.problems[0].message).toContain('rename it in the Assets tab');
    }
  });

  it('a message with no number can never get an amount from the model (it said 100 crore)', async () => {
    const w = await world();
    const host = scripted({ intent: 'borrow', amount: '100cr', date: '', fromAccount: 'Dubakur Bank - Home Loan', toAccount: 'HDFC Bank' });
    const out = await proposeEntry(host, {
      tab: 'liabilities',
      message: 'Dubakur Bank - Home Loan is a liability and not an asset',
      ...w.ctx(),
    });
    expect(out.type).toBe('needs-input');
    if (out.type === 'needs-input') {
      expect(out.draft.amountText).toBe('');
      expect(out.problems.some((p) => p.code === 'amount')).toBe(true);
    }
  });
});

describe('renaming an account', () => {
  it('changes the name, keeps the history, and survives a reload', async () => {
    const w = await world();
    const key = w.find('HDFC Bank').key;
    await commitRename(w.vault, w.data, key, '  HDFC Savings  ');
    expect(w.data.accounts.get(key)!.name).toBe('HDFC Savings');
    expect(w.data.ledger.balance(key)).toBe(3_000_000);
    const loaded = await loadAll(w.vault);
    expect(loaded.accounts.get(key)!.name).toBe('HDFC Savings');
  });

  it('refuses blank names, duplicates and the app\'s own accounts', async () => {
    const w = await world();
    const key = w.find('HDFC Bank').key;
    await expect(commitRename(w.vault, w.data, key, '  ')).rejects.toThrow('Give the account a name');
    await expect(commitRename(w.vault, w.data, key, 'delhi')).rejects.toThrow('already uses this name');
    await expect(commitRename(w.vault, w.data, w.find('Opening Equity').key, 'Capital')).rejects.toThrow('cannot be renamed');
    expect(w.data.accounts.get(key)!.name).toBe('HDFC Bank');
  });

  it('frees a mistaken name so the right account can be created', async () => {
    const w = await world();
    const mistaken = w.find('Savings'); // pretend this was the wrong "Dubakur Bank - Home Loan" asset
    await commitRename(w.vault, w.data, mistaken.key, 'Dubakur Bank - Home Loan (wrong, unused)');
    const r = resolveAny(d({ intent: 'borrow', amountText: '1L', fromName: 'Dubakur Bank - Home Loan', toName: 'HDFC Bank' }), w.ctx());
    expect(r.ok).toBe(true);
  });
});
