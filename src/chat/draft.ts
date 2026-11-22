import { formatDate } from '../dates/dates';
import { resolveDatePhrase } from '../dates/resolve';
import type { Account, AccountKind, Entry } from '../ledger/types';
import { formatRupees, parseRupees, type Rupees } from '../money/money';
import { validateEntry } from '../rules/rules';
import { newId } from '../setup/setup';
import type { Budget, Goal } from '../targets/types';
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
  budgets?: ReadonlyMap<string, Budget>;
  goals?: ReadonlyMap<string, Goal>;
  today: string;
  balanceOf: (accountKey: string) => Rupees;
  makeId?: (prefix: string) => string;
}

export interface Resolved {
  kind: 'entry';
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
  if (intent.target) return { ok: false, problems: [{ code: 'intent', message: 'Use resolveAny for budgets and goals.' }] };

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
    head = ({
      income: `Received ${m} from ${fromN} into ${toN}`,
      expense: `Paid ${m} for ${toN} from ${fromN}`,
      transfer: `Moved ${m} from ${fromN} to ${toN}`,
      borrow: `Borrowed ${m} (${fromN}); received into ${toN}`,
      repay: `Repaid ${m} on ${toN}; paid from ${fromN}`,
      revalue: '',
    } as Partial<Record<IntentId, string>>)[draft.intent] ?? '';
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
    intent: draft.intent,
  };

  const merged = new Map(ctx.accounts);
  for (const a of newAccounts) merged.set(a.key, a);
  const ruleProblems = validateEntry(entry, merged);
  if (ruleProblems.length) return { ok: false, problems: ruleProblems.map((message) => ({ code: 'rules' as const, message })) };

  const name = (key: string) => merged.get(key)!.name;
  return {
    ok: true,
    kind: 'entry' as const,
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

// ---------------------------------------------------------------------------------------------
// Budgets and Goals: targets that attach to ledger accounts and do not post entries.
// ---------------------------------------------------------------------------------------------

export interface ResolvedBudget {
  kind: 'budget';
  key: string;
  budget: Budget;
  newAccounts: Account[];
  warnings: string[];
  summary: string;
}
export interface ResolvedGoal {
  kind: 'goal';
  key: string;
  goal: Goal;
  newAccounts: Account[];
  warnings: string[];
  summary: string;
}
export type AnyResolved = Resolved | ResolvedBudget | ResolvedGoal;
export type ResolveAnyResult = ({ ok: true } & AnyResolved) | { ok: false; problems: Problem[] };

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Goal dates: "Dec 2027" means the last day of that month, anything else uses the normal resolver. */
function resolveTargetDate(text: string, today: string): string | null {
  const m = /^([a-z]{3,9})[\s,]+(\d{4})$/i.exec(text.trim());
  if (m) {
    const month = MONTH_NAMES.findIndex((x) => m[1].toLowerCase().startsWith(x));
    if (month < 0) return null;
    const last = new Date(Date.UTC(Number(m[2]), month + 1, 0)).getUTCDate();
    return `${m[2]}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  return resolveDatePhrase(text, today);
}

export function resolveTarget(draft: EntryDraft, ctx: ResolveContext): ResolveAnyResult {
  const makeId = ctx.makeId ?? newId;
  const intent = draft.intent ? INTENTS[draft.intent] : null;
  if (!intent?.target) return { ok: false, problems: [{ code: 'intent', message: 'Choose what to set.' }] };
  const problems: Problem[] = [];
  const warnings: string[] = [];

  const amount = parseRupees(draft.amountText.trim());
  if (amount === null) problems.push({ code: 'amount', message: 'Enter a whole-rupee amount above zero, like 8000 or 3L.' });
  const toName = draft.toName.trim();
  if (toName === '') problems.push({ code: 'to', message: `Enter the account for "${intent.toLabel}".` });
  const goalName = draft.fromName.trim();
  if (draft.intent === 'set-goal' && goalName === '') problems.push({ code: 'from', message: 'Give the goal a name.' });

  let targetDate: string | null = null;
  if (draft.intent === 'set-goal' && draft.dateText.trim() !== '') {
    targetDate = resolveTargetDate(draft.dateText, ctx.today);
    if (!targetDate) problems.push({ code: 'date', message: 'I could not read the target date. Use DD/MMM/YYYY, like 31/Dec/2027.' });
    else if (targetDate <= ctx.today) problems.push({ code: 'date', message: 'The target date must be in the future.' });
  }
  if (problems.length) return { ok: false, problems };

  const side = findSide(toName, intent.toKind, ctx.accounts, ctx.today, makeId, 'to');
  if ('problem' in side) return { ok: false, problems: [side.problem] };
  const account = side.account;
  const newAccounts: Account[] = [];
  if (side.isNew) {
    if (draft.intent === 'set-goal') account.category = /invest/i.test(account.name) ? 'investment' : 'savings';
    newAccounts.push(account);
    warnings.push(`A new ${account.kind} account "${account.name}" will be created.`);
  } else if (draft.intent === 'set-goal' && account.category !== 'savings' && account.category !== 'investment') {
    return {
      ok: false,
      problems: [{ code: 'account-kind', message: `"${account.name}" is not a savings or investment account. Choose one of those, or type a new name.` }],
    };
  }

  const value = amount as Rupees;
  if (draft.intent === 'set-budget') {
    const existing = [...(ctx.budgets ?? new Map<string, Budget>()).entries()].find(([, b]) => b.accounts.includes(account.key));
    const key = existing?.[0] ?? makeId('budget');
    if (existing) warnings.push(`This replaces the current limit of ${formatRupees(existing[1].monthlyLimitRupees)}.`);
    const budget: Budget = { name: account.name, monthlyLimitRupees: value, accounts: [account.key] };
    return { ok: true, kind: 'budget', key, budget, newAccounts, warnings, summary: `Monthly budget for ${account.name}: ${formatRupees(value)}` };
  }

  const existing = [...(ctx.goals ?? new Map<string, Goal>()).entries()].find(([, g]) => norm(g.name) === norm(goalName));
  const key = existing?.[0] ?? makeId('goal');
  if (existing) warnings.push(`This replaces the existing goal "${existing[1].name}".`);
  const goal: Goal = { name: goalName, targetRupees: value, targetDate, account: account.key };
  const by = targetDate ? ` by ${formatDateShort(targetDate)}` : '';
  return { ok: true, kind: 'goal', key, goal, newAccounts, warnings, summary: `Goal "${goalName}": ${formatRupees(value)}${by}, saved in ${account.name}` };
}

/** One entry point for the Confirm Card: ledger entries and targets. */
export function resolveAny(draft: EntryDraft, ctx: ResolveContext): ResolveAnyResult {
  if (draft.intent && INTENTS[draft.intent].target) return resolveTarget(draft, ctx);
  return resolveDraft(draft, ctx);
}

/** Rebuild an editable draft from a saved chat entry so it can be corrected. Null when it cannot be. */
export function draftFromEntry(entry: Entry, accounts: ReadonlyMap<string, Account>): EntryDraft | null {
  if (!entry.intent || INTENTS[entry.intent].target || entry.intent === 'revalue') return null;
  if (entry.kind !== 'normal' && entry.kind !== 'correction') return null;
  const debit = entry.lines.find((l) => l.debitRupees > 0);
  const credit = entry.lines.find((l) => l.creditRupees > 0);
  if (!debit || !credit) return null;
  return {
    intent: entry.intent,
    amountText: String(debit.debitRupees),
    dateText: formatDate(entry.date),
    fromName: accounts.get(credit.account)?.name ?? '',
    toName: accounts.get(debit.account)?.name ?? '',
    userText: '',
    source: 'manual-form',
  };
}

function formatDateShort(iso: string): string {
  return formatDate(iso);
}
