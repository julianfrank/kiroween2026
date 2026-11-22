// Golden sentences: a fixed set of messages with the answer the app should end up proposing.
// Run against the real on-device model from "Data and password" > "Check the AI". They use their own
// made-up accounts, never the user's data, and nothing is saved.

import type { AnyResolved, EntryDraft } from '../chat/draft';
import type { ChatTabId, IntentId } from '../chat/intents';
import { proposeEntry, type Outcome, type PromptHost } from '../chat/proposal';
import { formatDate } from '../dates/dates';
import { resolveDatePhrase } from '../dates/resolve';
import type { Account } from '../ledger/types';
import { parseRupees } from '../money/money';
import { buildSetup, evaluateDraft, type DraftRow } from '../setup/setup';

/** Fixed "today" for the golden set: a Sunday, so weekday phrases have one right answer. */
export const GOLDEN_TODAY = '2026-11-22';

export interface GoldenCase {
  tab: ChatTabId;
  message: string;
  /** What the confirmed proposal should be. Fields left out are not scored. */
  expect:
    | { intent: IntentId; amount?: number; date?: string; from?: string; to?: string }
    | { redirect: ChatTabId; via: IntentId }
    | { other: true };
}

export const GOLDEN: GoldenCase[] = [
  // Daily Updates
  { tab: 'daily', message: 'Paid Rs.800 for groceries yesterday', expect: { intent: 'expense', amount: 800, date: '2026-11-21', to: 'Food' } },
  { tab: 'daily', message: 'Salary of 50k credited to HDFC Bank today', expect: { intent: 'income', amount: 50000, from: 'Salary', to: 'HDFC Bank' } },
  { tab: 'daily', message: 'Spent 1200 on petrol from cash', expect: { intent: 'expense', amount: 1200, from: 'Cash', to: 'Transport' } },
  { tab: 'daily', message: 'Paid rent of Rs.15,000 from HDFC Bank on 1 Nov', expect: { intent: 'expense', amount: 15000, date: '2026-11-01', from: 'HDFC Bank', to: 'Rent' } },
  { tab: 'daily', message: 'Electricity bill of 2300 paid from HDFC Bank', expect: { intent: 'expense', amount: 2300, from: 'HDFC Bank', to: 'Utilities' } },
  { tab: 'daily', message: 'Moved 10000 from HDFC Bank to Savings', expect: { intent: 'transfer', amount: 10000, from: 'HDFC Bank', to: 'Savings' } },
  { tab: 'daily', message: 'Withdrew 5000 cash from HDFC Bank', expect: { intent: 'transfer', amount: 5000, from: 'HDFC Bank', to: 'Cash' } },
  { tab: 'daily', message: 'Got 2000 as a gift in cash last Friday', expect: { intent: 'income', amount: 2000, date: '2026-11-20', to: 'Cash' } },
  { tab: 'daily', message: 'Bought vegetables for 450 two days ago', expect: { intent: 'expense', amount: 450, date: '2026-11-20', to: 'Food' } },
  { tab: 'daily', message: 'Auto fare 120 today', expect: { intent: 'expense', amount: 120, to: 'Transport' } },
  { tab: 'daily', message: 'Invested 25000 from HDFC Bank in Investments', expect: { intent: 'transfer', amount: 25000, from: 'HDFC Bank', to: 'Investments' } },
  { tab: 'daily', message: 'Freelance payment of 1.2L received in HDFC Bank on 15 Nov', expect: { intent: 'income', amount: 120000, date: '2026-11-15', to: 'HDFC Bank' } },
  { tab: 'daily', message: 'Dinner at a restaurant 1,800 from cash on 20/Nov/2026', expect: { intent: 'expense', amount: 1800, date: '2026-11-20', from: 'Cash', to: 'Food' } },
  { tab: 'daily', message: 'Paid 999 for internet from HDFC Bank 3 days ago', expect: { intent: 'expense', amount: 999, date: '2026-11-19', from: 'HDFC Bank', to: 'Utilities' } },
  // Liabilities
  { tab: 'liabilities', message: "I've taken a Loan of Rs.5000 from Tom", expect: { intent: 'borrow', amount: 5000, from: 'Loan - Tom' } },
  { tab: 'liabilities', message: 'Borrowed 20k from Tom into HDFC Bank yesterday', expect: { intent: 'borrow', amount: 20000, date: '2026-11-21', from: 'Loan - Tom', to: 'HDFC Bank' } },
  { tab: 'liabilities', message: 'Repaid 3000 to Tom from cash', expect: { intent: 'repay', amount: 3000, from: 'Cash', to: 'Loan - Tom' } },
  { tab: 'liabilities', message: 'Paid 5,000 towards the Card bill from HDFC Bank', expect: { intent: 'repay', amount: 5000, from: 'HDFC Bank', to: 'Card' } },
  { tab: 'liabilities', message: 'Took a home loan of 50L from Dubakur Bank into HDFC Bank', expect: { intent: 'borrow', amount: 5_000_000, to: 'HDFC Bank' } },
  { tab: 'liabilities', message: 'Returned Rs.1500 to Tom on 18 Nov', expect: { intent: 'repay', amount: 1500, date: '2026-11-18', to: 'Loan - Tom' } },
  // Assets
  { tab: 'assets', message: 'My House is now worth 85L', expect: { intent: 'revalue', amount: 8_500_000, to: 'House' } },
  { tab: 'assets', message: 'House value dropped to 70L', expect: { intent: 'revalue', amount: 7_000_000, to: 'House' } },
  { tab: 'assets', message: 'Investments are now worth 1.5L', expect: { intent: 'revalue', amount: 150_000, to: 'Investments' } },
  { tab: 'assets', message: 'Moved 2000 from Cash to Savings', expect: { intent: 'transfer', amount: 2000, from: 'Cash', to: 'Savings' } },
  // Goals
  { tab: 'goals', message: 'Save 3L for an emergency fund by Dec 2027', expect: { intent: 'set-goal', amount: 300_000 } },
  { tab: 'goals', message: 'I want to save 50k for a trip in Savings', expect: { intent: 'set-goal', amount: 50_000, to: 'Savings' } },
  { tab: 'goals', message: 'Put 5000 from HDFC Bank into Savings for my goal', expect: { intent: 'transfer', amount: 5000, from: 'HDFC Bank', to: 'Savings' } },
  // Budgets
  { tab: 'budgets', message: 'Set a monthly budget of 8000 for Food', expect: { intent: 'set-budget', amount: 8000, to: 'Food' } },
  { tab: 'budgets', message: 'Limit transport spending to 3k a month', expect: { intent: 'set-budget', amount: 3000, to: 'Transport' } },
  { tab: 'budgets', message: 'Rent budget 15000', expect: { intent: 'set-budget', amount: 15000, to: 'Rent' } },
  // Messages that belong to another tab
  { tab: 'liabilities', message: 'Paid Rs.800 for groceries', expect: { redirect: 'daily', via: 'expense' } },
  { tab: 'budgets', message: 'Spent 500 on food today', expect: { redirect: 'daily', via: 'expense' } },
  { tab: 'daily', message: 'Borrowed 1000 from Tom', expect: { redirect: 'liabilities', via: 'borrow' } },
  { tab: 'assets', message: 'Set a budget of 2000 for Utilities', expect: { redirect: 'budgets', via: 'set-budget' } },
  // Not money events
  { tab: 'daily', message: 'Hello, how are you?', expect: { other: true } },
  { tab: 'daily', message: 'Dubakur Bank - Home Loan is a liability and not an asset', expect: { other: true } },
];

function row(over: Partial<DraftRow>): DraftRow {
  return { id: Math.random().toString(36).slice(2), kind: 'asset', category: null, name: '', amountText: '', asOfText: '01/Jan/2026', ...over };
}

/** Made-up books the golden set runs against. */
export function goldenWorld() {
  const rows: DraftRow[] = [
    row({ name: 'Cash', amountText: '20,000' }),
    row({ name: 'HDFC Bank', amountText: '5L' }),
    row({ name: 'Savings', amountText: '1L', category: 'savings' }),
    row({ name: 'Investments', amountText: '2L', category: 'investment' }),
    row({ name: 'House', amountText: '80L', asOfText: '10/May/2000' }),
    row({ kind: 'liability', name: 'Loan - Tom', amountText: '10,000' }),
    row({ kind: 'liability', name: 'Card', amountText: '15,000' }),
  ];
  const ev = evaluateDraft(rows, '', GOLDEN_TODAY);
  const { accounts, ledger } = buildSetup(ev.lines, ev.assets - ev.liabilities, GOLDEN_TODAY);
  return { accounts, ledger };
}

export type Field = 'intent' | 'amount' | 'date' | 'from' | 'to' | 'tab';

export interface CaseResult {
  case: GoldenCase;
  pass: boolean;
  /** Field -> [expected, got] for every field that was scored. */
  fields: Partial<Record<Field, { ok: boolean; expected: string; got: string }>>;
  /** What the model replied, word for word (for diagnosing failures). */
  reply?: string;
}

export interface GoldenReport {
  total: number;
  passed: number;
  /** Per field: [right, scored]. */
  byField: Record<Field, [number, number]>;
  results: CaseResult[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const sameName = (expected: string, got: string) => {
  const a = norm(expected);
  const b = norm(got);
  return a !== '' && b !== '' && (a === b || a.includes(b) || b.includes(a));
};

function names(r: AnyResolved, accounts: ReadonlyMap<string, Account>): { from: string; to: string } {
  if (r.kind === 'entry') {
    const merged = new Map(accounts);
    for (const a of r.newAccounts) merged.set(a.key, a);
    if (r.entry.kind === 'revaluation') {
      // A loss debits Valuation Loss and credits the asset, so the asset is the line that is not the app's own.
      const asset = r.entry.lines.map((l) => merged.get(l.account)).find((a) => a && !a.system);
      return { from: '', to: asset?.name ?? '' };
    }
    const debit = r.entry.lines.find((l) => l.debitRupees > 0)!;
    const credit = r.entry.lines.find((l) => l.creditRupees > 0)!;
    return { from: merged.get(credit.account)?.name ?? '', to: merged.get(debit.account)?.name ?? '' };
  }
  const key = r.kind === 'budget' ? r.budget.accounts[0] : r.goal.account;
  return { from: '', to: (accounts.get(key) ?? r.newAccounts.find((a) => a.key === key))?.name ?? '' };
}

/** Score one outcome. Exported for tests. */
export function scoreCase(c: GoldenCase, outcome: Outcome, accounts: ReadonlyMap<string, Account>): CaseResult {
  const fields: CaseResult['fields'] = {};
  const put = (f: Field, ok: boolean, expected: string, got: string) => (fields[f] = { ok, expected, got });
  const kindOf = (o: Outcome) => (o.type === 'redirect' ? `redirect to ${o.tab}` : o.type === 'error' ? `error: ${o.message}` : (o.draft.intent ?? 'none'));

  if ('redirect' in c.expect) {
    put('tab', outcome.type === 'redirect' && outcome.tab === c.expect.redirect, `redirect to ${c.expect.redirect}`, kindOf(outcome));
  } else if ('other' in c.expect) {
    put('intent', outcome.type === 'needs-input' && outcome.draft.intent === null, 'nothing to record', kindOf(outcome));
  } else {
    const e = c.expect;
    const draft: EntryDraft | null = outcome.type === 'confirm' || outcome.type === 'needs-input' ? outcome.draft : null;
    put('intent', draft?.intent === e.intent, e.intent, kindOf(outcome));
    if (draft) {
      if (e.amount !== undefined) {
        const got = parseRupees(draft.amountText);
        put('amount', got === e.amount, String(e.amount), draft.amountText || '(none)');
      }
      if (e.intent !== 'set-budget' && e.intent !== 'set-goal') {
        const want = e.date ?? GOLDEN_TODAY;
        const got = draft.dateText.trim() === '' ? GOLDEN_TODAY : resolveDatePhrase(draft.dateText, GOLDEN_TODAY);
        put('date', got === want, formatDate(want), got ? formatDate(got) : `unreadable "${draft.dateText}"`);
      }
      let got = { from: draft.fromName, to: draft.toName };
      if (outcome.type === 'confirm') got = names(outcome.resolved, accounts);
      if (e.from !== undefined) put('from', sameName(e.from, got.from), e.from, got.from || '(none)');
      if (e.to !== undefined) put('to', sameName(e.to, got.to), e.to, got.to || '(none)');
    }
  }
  const reply = 'reply' in outcome ? outcome.reply : undefined;
  return { case: c, pass: Object.values(fields).every((f) => f!.ok), fields, reply };
}

/** Run every golden sentence through the same pipeline the chat uses. Nothing is saved. */
export async function runGolden(
  host: PromptHost,
  onProgress?: (done: number, total: number) => void,
  cases: GoldenCase[] = GOLDEN,
): Promise<GoldenReport> {
  const { accounts, ledger } = goldenWorld();
  const results: CaseResult[] = [];
  for (const c of cases) {
    const outcome = await proposeEntry(host, {
      tab: c.tab,
      message: c.message,
      today: GOLDEN_TODAY,
      accounts,
      budgets: new Map(),
      goals: new Map(),
      balanceOf: (k) => ledger.balance(k),
    });
    results.push(scoreCase(c, outcome, accounts));
    onProgress?.(results.length, cases.length);
  }
  const byField = { intent: [0, 0], amount: [0, 0], date: [0, 0], from: [0, 0], to: [0, 0], tab: [0, 0] } as Record<Field, [number, number]>;
  for (const r of results) {
    for (const [f, v] of Object.entries(r.fields) as Array<[Field, { ok: boolean }]>) {
      byField[f][1]++;
      if (v.ok) byField[f][0]++;
    }
  }
  return { total: results.length, passed: results.filter((r) => r.pass).length, byField, results };
}

/** Plain-text report the user can paste back to the developer. */
export function formatReport(r: GoldenReport, chromeVersion = ''): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  const lines = [
    `Golden sentences: ${r.passed} of ${r.total} passed (${pct(r.passed, r.total)})${chromeVersion ? `, ${chromeVersion}` : ''}`,
    ...(Object.entries(r.byField) as Array<[Field, [number, number]]>)
      .filter(([, [, n]]) => n > 0)
      .map(([f, [ok, n]]) => `  ${f}: ${ok}/${n} (${pct(ok, n)})`),
  ];
  const failed = r.results.filter((x) => !x.pass);
  if (failed.length) lines.push('', 'Failures:');
  for (const f of failed) {
    lines.push(`- [${f.case.tab}] "${f.case.message}"`);
    for (const [name, v] of Object.entries(f.fields)) if (!v!.ok) lines.push(`    ${name}: expected ${v!.expected}, got ${v!.got}`);
    if (f.reply) lines.push(`    model said: ${f.reply.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  return lines.join('\n');
}

/** For tests: what a perfect model would reply to a case. */
export function idealReply(c: GoldenCase): string {
  if ('other' in c.expect) return JSON.stringify({ intent: 'other', amount: '', date: '', fromAccount: '', toAccount: '' });
  const e = 'redirect' in c.expect ? { intent: c.expect.via } : c.expect;
  const r = e as { intent: IntentId; amount?: number; date?: string; from?: string; to?: string };
  return JSON.stringify({
    intent: r.intent,
    amount: r.amount !== undefined ? String(r.amount) : '',
    date: r.date ?? '',
    fromAccount: r.from ?? (r.intent === 'expense' || r.intent === 'transfer' ? 'Cash' : r.intent === 'set-goal' ? 'Goal' : ''),
    toAccount: r.to ?? (r.intent === 'income' || r.intent === 'borrow' ? 'Cash' : r.intent === 'set-goal' ? 'Savings' : r.intent === 'expense' ? 'Food' : ''),
  });
}
