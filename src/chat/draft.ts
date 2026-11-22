import { resolveDatePhrase } from '../dates/resolve';
import type { Account, AccountKind, Entry } from '../ledger/types';
import { formatRupees, parseRupees, type Rupees } from '../money/money';
import { validateEntry } from '../rules/rules';
import { newId } from '../setup/setup';
import { INTENTS, type IntentId } from './intents';

/** What the Confirm Card edits. Everything is text the user can change. */
export interface EntryDraft {
  intent: IntentId | null;
  amountText: string;
  dateText: string;
  fromName: string;
  toName: string;
  /** The message the user typed, kept in the entry's note. */
  userText: string;
  source: 'ai-confirmed' | 'manual-form';
}

export type ProblemCode =
  | 'intent'
  | 'amount'
  | 'date'
  | 'from'
  | 'to'
  | 'account-kind'
  | 'ambiguous'
  | 'same-account'
  | 'no-change'
  | 'rules';

export interface Problem {
  code: ProblemCode;
  message: string;
}

export interface ResolveContext {
  accounts: ReadonlyMap<string, Account>;
  today: string;
  balanceOf: (accountKey: string) => Rupees;
  makeId?: (prefix: string) => string;
}

export interface Resolved {
  entry: Entry;
  newAccounts: Account[];
  /** For display: "Debit Cash ₹5,000" style lines. */
  lines: Array<{ side: 'Debit' | 'Credit'; accountName: string; amount: Rupees }>;
  warnings: string[];
}

export type ResolveResult = ({ ok: true } & Resolved) | { ok: false; problems: Problem[] };

export const KIND_LABEL: Record<AccountKind, string> = {
  asset: 'an asset account',
  liability: 'a liability account',
  equity: 'an equity account',
  income: 'an income account',
  expense: 'an expense account',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

type Side = { account: Account; isNew: boolean } | { problem: Problem };

function findSide(
  name: string,
  kind: AccountKind,
  accounts: ReadonlyMap<string, Account>,
  date: string,
  makeId: (p: string) => string,
  code: 'from' | 'to',
): Side {
  const n = norm(name);
  const all = [...accounts.values()];
  const exact = all.find((a) => norm(a.name) === n);
  if (exact) {
    if (exact.kind === kind) return { account: exact, isNew: false };
    return {
      problem: {
        code: 'account-kind',
        message: `"${exact.name}" is ${KIND_LABEL[exact.kind]}, but ${KIND_LABEL[kind]} is needed here.`,
      },
    };
  }
  if (n.length >= 3) {
    const near = all.filter(
      (a) => a.kind === kind && !a.system && norm(a.name).length >= 3 && (norm(a.name).includes(n) || n.includes(norm(a.name))),
    );
    if (near.length === 1) return { account: near[0], isNew: false };
    if (near.length > 1) {
      return {
        problem: {
          code: 'ambiguous',
          message: `"${name}" matches ${near.map((a) => a.name).join(', ')}. Type the exact name.`,
        },
      };
    }
  }
  void code;
  const key = makeId('acct');
  return { account: { key, name: name.trim(), kind, category: null, asOfDate: date }, isNew: true };
}

export function resolveDraft(draft: EntryDraft, ctx: ResolveContext): ResolveResult {
  const makeId = ctx.makeId ?? newId;
  const problems: Problem[] = [];
  const warnings: string[] = [];

  if (!draft.intent) return { ok: false, problems: [{ code: 'intent', message: 'Choose what kind of entry this is.' }] };
  const intent = INTENTS[draft.intent];

  // Amount: whole rupees. A new asset value of 0 is allowed.
  let amount: Rupees | null = null;
  const amountText = draft.amountText.trim();
  if (draft.intent === 'revalue' && /^(₹|rs\.?|inr)?\s*0+$/i.test(amountText)) amount = 0;
  else amount = parseRupees(amountText);
  if (amount === null) {
    problems.push({
      code: 'amount',
      message: /\d\.\d/.test(amountText) && !/[a-z]/i.test(amountText.replace(/^rs\.?/i, ''))
        ? 'Whole rupees only, no paise.'
        : 'Enter the amount in whole rupees, like 5000 or 1.2L.',
    });
  }

  // Date: empty means today.
  let date = ctx.today;
  if (draft.dateText.trim() !== '') {
    const resolved = resolveDatePhrase(draft.dateText, ctx.today);
    if (!resolved) problems.push({ code: 'date', message: 'I could not read the date. Use DD/MMM/YYYY, like 22/Nov/2026.' });
    else date = resolved;
  }
  if (date > ctx.today) warnings.push('This date is in the future.');

  const toName = draft.toName.trim();
  const fromName = draft.fromName.trim();
  if (toName === '') problems.push({ code: 'to', message: `Enter the account for "${intent.toLabel}".` });
  if (intent.fromKind && fromName === '') problems.push({ code: 'from', message: `Enter the account for "${intent.fromLabel}".` });
  if (problems.length) return { ok: false, problems };

  const to = findSide(toName, intent.toKind, ctx.accounts, date, makeId, 'to');
  const from = intent.fromKind
    ? findSide(fromName, intent.fromKind, ctx.accounts, date, makeId, 'from')
    : null;
  for (const s of [to, from]) if (s && 'problem' in s) problems.push(s.problem);
  if (problems.length) return { ok: false, problems };
  const toAcct = (to as { account: Account; isNew: boolean });
  const fromAcct = from as { account: Account; isNew: boolean } | null;
  if (fromAcct && fromAcct.account.name.toLowerCase() === toAcct.account.name.toLowerCase()) {
    return { ok: false, problems: [{ code: 'same-account', message: 'The two accounts must be different.' }] };
  }

  const newAccounts = [toAcct, fromAcct].flatMap((s) => (s?.isNew ? [s.account] : []));
  for (const a of newAccounts) warnings.push(`A new ${a.kind} account "${a.name}" will be created.`);

  const amt = amount as Rupees;
  let lines: Entry['lines'];
  let head: string;
  let kind: Entry['kind'] = 'normal';
  const fromN = fromAcct?.account.name ?? '';
  const toN = toAcct.account.name;

  if (draft.intent === 'revalue') {
    kind = 'revaluation';
    const current = toAcct.isNew ? 0 : ctx.balanceOf(toAcct.account.key);
    const delta = amt - current;
    if (delta === 0) return { ok: false, problems: [{ code: 'no-change', message: `${toN} is already worth ${formatRupees(current)}.` }] };
    // Gain and loss are booked as Profit or Loss (Income or Expense).
    const gain = [...ctx.accounts.values()].find((a) => a.system === 'valuation-gain');
    const loss = [...ctx.accounts.values()].find((a) => a.system === 'valuation-loss');
    if (!gain || !loss) return { ok: false, problems: [{ code: 'rules', message: 'Valuation accounts are missing. Re-run setup.' }] };
    const abs = Math.abs(delta);
    lines =
      delta > 0
        ? [
            { account: toAcct.account.key, debitRupees: abs, creditRupees: 0 },
            { account: gain.key, debitRupees: 0, creditRupees: abs },
          ]
        : [
            { account: loss.key, debitRupees: abs, creditRupees: 0 },
            { account: toAcct.account.key, debitRupees: 0, creditRupees: abs },
          ];
    head = `Revalued ${toN} from ${formatRupees(current)} to ${formatRupees(amt)} (${delta > 0 ? 'profit' : 'loss'} of ${formatRupees(abs)})`;
    warnings.push(`This is booked as a ${delta > 0 ? 'Valuation Gain (income)' : 'Valuation Loss (expense)'} of ${formatRupees(abs)}.`);
  } else {
    lines = [
      { account: toAcct.account.key, debitRupees: amt, creditRupees: 0 },
      { account: fromAcct!.account.key, debitRupees: 0, creditRupees: amt },
    ];
    const m = formatRupees(amt);
    head = {
      income: `Received ${m} from ${fromN} into ${toN}`,
      expense: `Paid ${m} for ${toN} from ${fromN}`,
      transfer: `Moved ${m} from ${fromN} to ${toN}`,
      borrow: `Borrowed ${m} (${fromN}); received into ${toN}`,
      repay: `Repaid ${m} on ${toN}; paid from ${fromN}`,
      revalue: '',
    }[draft.intent];
  }

  const said = draft.userText.trim();
  const entry: Entry = {
    date,
    note: said ? `${head}. You said: "${said}"` : head,
    lines,
    kind,
    reverses: null,
    correctionOf: null,
    source: draft.source,
  };

  const merged = new Map(ctx.accounts);
  for (const a of newAccounts) merged.set(a.key, a);
  const ruleProblems = validateEntry(entry, merged);
  if (ruleProblems.length) return { ok: false, problems: ruleProblems.map((message) => ({ code: 'rules' as const, message })) };

  const name = (key: string) => merged.get(key)!.name;
  return {
    ok: true,
    entry,
    newAccounts,
    warnings,
    lines: entry.lines.map((l) =>
      l.debitRupees > 0
        ? { side: 'Debit' as const, accountName: name(l.account), amount: l.debitRupees }
        : { side: 'Credit' as const, accountName: name(l.account), amount: l.creditRupees },
    ),
  };
}

export function blankDraft(userText = ''): EntryDraft {
  return { intent: null, amountText: '', dateText: '', fromName: '', toName: '', userText, source: 'manual-form' };
}
