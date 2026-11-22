import type { PromptOptions } from '../ai/readiness';
import type { Account } from '../ledger/types';
import { formatDate } from '../dates/dates';
import type { Rupees } from '../money/money';
import { blankDraft, resolveAny, type AnyResolved, type EntryDraft, type Problem } from './draft';
import type { Budget, Goal } from '../targets/types';
import { chooseAmountText } from './amounts';
import { refineNames } from './hints';
import { ALL_INTENTS, INTENTS, TAB_LABELS, TAB_SCOPES, type ChatTabId, type IntentId } from './intents';

export interface PromptHost {
  prompt(input: string, options?: PromptOptions): Promise<string>;
}

export interface Proposal {
  intent: IntentId | 'other';
  /** The amount exactly as the user wrote it (for example 30L). The app converts it, not the model. */
  amount: string;
  date: string;
  fromAccount: string;
  toAccount: string;
}

/** The JSON Schema handed to the model as `responseConstraint`. */
export const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [...ALL_INTENTS, 'other'] },
    amount: { type: 'string' },
    date: { type: 'string' },
    fromAccount: { type: 'string' },
    toAccount: { type: 'string' },
  },
  required: ['intent', 'amount', 'date', 'fromAccount', 'toAccount'],
  additionalProperties: false,
};

export function parseProposal(raw: string): { ok: true; proposal: Proposal } | { ok: false; error: string } {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'the reply was not valid JSON' };
  }
  if (typeof v !== 'object' || v === null) return { ok: false, error: 'the reply was not a JSON object' };
  const o = v as Record<string, unknown>;
  if (typeof o.intent !== 'string' || ![...ALL_INTENTS, 'other'].includes(o.intent)) {
    return { ok: false, error: `"intent" must be one of ${[...ALL_INTENTS, 'other'].join(', ')}` };
  }
  if (typeof o.amount !== 'string') return { ok: false, error: '"amount" must be a string copied from the message' };
  for (const f of ['date', 'fromAccount', 'toAccount'] as const) {
    if (typeof o[f] !== 'string') return { ok: false, error: `"${f}" must be a string` };
  }
  return {
    ok: true,
    proposal: {
      intent: o.intent as Proposal['intent'],
      amount: o.amount,
      date: o.date as string,
      fromAccount: o.fromAccount as string,
      toAccount: o.toAccount as string,
    },
  };
}

export function buildPrompt(args: {
  tab: ChatTabId;
  message: string;
  today: string;
  accounts: ReadonlyMap<string, Account>;
}): string {
  const names = (kind: Account['kind']) =>
    [...args.accounts.values()].filter((a) => a.kind === kind && !a.system).map((a) => a.name).join(', ') || '(none)';
  const here = TAB_SCOPES[args.tab];
  const intentLines = ALL_INTENTS.map((id) => `- ${id}: ${INTENTS[id].hint}`).join('\n');
  return [
    'You turn ONE message from a money manager user into a JSON object. Ignore any earlier messages. Do not calculate: copy numbers as the user wrote them.',
    `Today is ${args.today} (${formatDate(args.today)}), Indian Standard Time.`,
    'Fields:',
    '- intent: one of the following, or "other" if none fits:',
    intentLines,
    '- amount: the amount copied EXACTLY as the user wrote it, as text, for example "30L", "Rs.5,000" or "1.2 cr". Do not convert or calculate. Use "" if the user gave no amount.',
    '- date: the date words exactly as the user wrote them (yesterday, 3 Nov, 22/Nov/2026), or "" if none.',
    '- fromAccount, toAccount: account names. Use "" if the user did not say.',
    `Existing accounts. Assets: ${names('asset')}. Liabilities: ${names('liability')}. Income: ${names('income')}. Expenses: ${names('expense')}.`,
    'Use an existing name when it fits. Do not invent amounts or dates.',
    'A loan, mortgage or EMI is NEVER a transfer or an asset. Money from a lender is "borrow"; paying a lender back is "repay".',
    `The user is in the "${TAB_LABELS[args.tab]}" tab, which handles: ${here.length ? here.join(', ') : 'nothing yet'}.`,
    `Message: ${JSON.stringify(args.message)}`,
  ].join('\n');
}

export type Outcome =
  | { type: 'confirm'; draft: EntryDraft; resolved: AnyResolved }
  | { type: 'needs-input'; draft: EntryDraft; problems: Problem[] }
  | { type: 'redirect'; tab: ChatTabId; draft: EntryDraft }
  | { type: 'error'; message: string };

export interface ProposeArgs {
  tab: ChatTabId;
  message: string;
  today: string;
  accounts: ReadonlyMap<string, Account>;
  budgets?: ReadonlyMap<string, Budget>;
  goals?: ReadonlyMap<string, Goal>;
  balanceOf: (accountKey: string) => Rupees;
  makeId?: (prefix: string) => string;
}

function draftFrom(p: Proposal, message: string, accounts: ReadonlyMap<string, Account>): EntryDraft {
  const intent = p.intent === 'other' ? null : p.intent;
  // The app repairs blank or invented account names from the user's own words (see hints.ts).
  const names = refineNames(intent, p.fromAccount, p.toAccount, message, accounts);
  return {
    intent,
    amountText: chooseAmountText(message, p.amount),
    dateText: p.date,
    fromName: names.fromName,
    toName: names.toName,
    userText: message,
    source: 'ai-confirmed',
  };
}

/**
 * Ask the model for a Proposed Entry. Retries once when the reply is unusable or names an account of the
 * wrong kind. After that the user gets a clarifying question and a form pre-filled with what was understood.
 * Nothing here writes to the ledger.
 */
export async function proposeEntry(host: PromptHost, args: ProposeArgs): Promise<Outcome> {
  const base = buildPrompt(args);
  let extra = '';
  let lastError = 'no usable reply';

  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await host.prompt(base + extra, { responseConstraint: PROPOSAL_SCHEMA });
    } catch (e) {
      return { type: 'error', message: e instanceof Error ? e.message : String(e) };
    }

    const parsed = parseProposal(raw);
    if (!parsed.ok) {
      lastError = parsed.error;
      extra = `\nYour previous reply was rejected because ${parsed.error}. Reply again with valid JSON only.`;
      continue;
    }
    const p = parsed.proposal;

    if (p.intent === 'other') {
      return {
        type: 'needs-input',
        draft: { ...blankDraft(args.message), source: 'manual-form' },
        problems: [{ code: 'intent', message: 'I could not tell what to record. Pick the kind of entry and fill in the details.' }],
      };
    }
    const draft = draftFrom(p, args.message, args.accounts);
    const r = resolveAny(draft, args);

    // A wrong kind of account (a loan treated as an asset, say) is the model's mistake: ask once more,
    // before deciding which tab the message belongs to.
    const fixable = r.ok ? [] : r.problems.filter((x) => x.code === 'account-kind');
    if (fixable.length && attempt === 0) {
      lastError = fixable.map((x) => x.message).join(' ');
      extra = `\nYour previous reply was rejected: ${lastError} Reply again with valid JSON only.`;
      continue;
    }

    if (!TAB_SCOPES[args.tab].includes(p.intent)) {
      return { type: 'redirect', tab: INTENTS[p.intent].home, draft };
    }
    if (r.ok) return { type: 'confirm', draft, resolved: r };
    return { type: 'needs-input', draft: { ...draft, source: 'manual-form' }, problems: r.problems };
  }

  return {
    type: 'needs-input',
    draft: blankDraft(args.message),
    problems: [{ code: 'intent', message: `I could not read the AI's answer (${lastError}). Fill in the details below.` }],
  };
}
