// The app repairs the model's account names from the user's own words. Found by the golden-sentence run on
// the real model (Chrome 157, 31 of 36): it invented "Petrol" instead of Transport, picked "Other Expense"
// for a dinner, and left an account blank even though the message named it ("into HDFC Bank", "from Tom").
// Only the model's answer is repaired; anything the user types on the Confirm Card is kept as typed.

import type { Account, AccountKind } from '../ledger/types';
import { INTENTS, type IntentId } from './intents';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/** Everyday words for the starter spending categories. */
export const CATEGORY_WORDS: Array<[string, RegExp]> = [
  ['Transport', /\b(petrol|diesel|fuel|cng|cab|cabs|taxi|uber|ola|auto|autos|rickshaw|metro|bus|train|flight|toll|parking|transport)\b/i],
  ['Food', /\b(food|groceries|grocery|vegetables|veggies|fruit|fruits|dinner|lunch|breakfast|restaurant|snacks?|takeaway|swiggy|zomato|meal|meals|milk|eating|tea|coffee)\b/i],
  ['Utilities', /\b(electricity|power bill|water bill|water|gas|lpg|internet|wifi|broadband|phone bill|mobile bill|recharge|utilities)\b/i],
  ['Rent', /\b(rent|lease)\b/i],
];

/** The starter category the message is about, if that category exists in the books. */
export function categoryFromText(text: string, accounts: ReadonlyMap<string, Account>): string | null {
  for (const [name, re] of CATEGORY_WORDS) {
    if (!re.test(text)) continue;
    const a = [...accounts.values()].find((x) => x.kind === 'expense' && !x.system && norm(x.name) === norm(name));
    if (a) return a.name;
  }
  return null;
}

/** Words too common to identify an account on their own. */
const GENERIC = new Set(['loan', 'bank', 'card', 'account', 'credit', 'home', 'personal', 'the', 'my', 'and', 'cash']);

/**
 * The one existing account of `kind` that the message names: its full name ("HDFC Bank"), or for a loan
 * its distinctive word ("Tom" for "Loan - Tom"). Null when none or more than one fits.
 */
export function accountInMessage(
  message: string,
  kind: AccountKind,
  accounts: ReadonlyMap<string, Account>,
  exclude = '',
): string | null {
  const saidWords = words(message);
  const candidates = [...accounts.values()].filter((a) => a.kind === kind && !a.system && norm(a.name) !== norm(exclude));
  // The whole name as words, so "Car" does not match "card": "HDFC Bank" -> /\bhdfc\W*bank\b/i
  const namedIn = (a: Account) => {
    const tokens = a.name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return tokens.join('').length >= 3 && new RegExp(`\\b${tokens.join('\\W*')}\\b`, 'i').test(message);
  };
  const full = candidates.filter(namedIn);
  if (full.length === 1) return full[0].name;
  if (full.length > 1) return full.sort((x, y) => norm(y.name).length - norm(x.name).length)[0].name;
  if (kind !== 'liability') return null;
  const byWord = candidates.filter((a) => [...words(a.name)].some((w) => w.length >= 3 && !GENERIC.has(w) && saidWords.has(w)));
  return byWord.length === 1 ? byWord[0].name : null;
}

/** "Loan - Meera" for a lender the books do not know yet ("borrowed 5000 from Meera"). */
export function newLenderFromMessage(message: string, accounts: ReadonlyMap<string, Account>): string | null {
  const m = /\bfrom\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/.exec(message);
  if (!m) return null;
  const name = m[1].trim();
  if ([...accounts.values()].some((a) => norm(a.name) === norm(name))) return null; // "from Cash": an account, not a lender
  return `Loan - ${name}`;
}

/**
 * Repair the model's account names using the user's message. Changes only empty names, a name the books
 * do not have that a known category explains, and the catch-all "Other Expense" when the message clearly
 * names a category.
 */
export function refineNames(
  intent: IntentId | null,
  fromName: string,
  toName: string,
  message: string,
  accounts: ReadonlyMap<string, Account>,
): { fromName: string; toName: string } {
  if (!intent) return { fromName, toName };
  const def = INTENTS[intent];
  const exists = (n: string) => [...accounts.values()].some((a) => norm(a.name) === norm(n));
  let from = fromName.trim();
  let to = toName.trim();

  if (intent === 'expense' || intent === 'set-budget') {
    const category = categoryFromText(message, accounts);
    const generic = norm(to) === norm('Other Expense');
    if (category && (to === '' || generic || !exists(to))) to = category;
  }
  if (to === '' && def.toKind) to = accountInMessage(message, def.toKind, accounts, from) ?? '';
  if (from === '' && def.fromKind) {
    from = accountInMessage(message, def.fromKind, accounts, to) ?? '';
    if (from === '' && intent === 'borrow') from = newLenderFromMessage(message, accounts) ?? '';
  }
  return { fromName: from, toName: to };
}
