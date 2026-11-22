import type { Account, Entry } from '../ledger/types';
import { Ledger } from '../ledger/ledger';
import type { Budget, Goal } from '../targets/types';
import type { Vault } from './vault';

type StoredAccount = Omit<Account, 'key'>;

export interface LoadedData {
  accounts: Map<string, Account>;
  ledger: Ledger;
  budgets: Map<string, Budget>;
  goals: Map<string, Goal>;
}

export function emptyTargets() {
  return { budgets: new Map<string, Budget>(), goals: new Map<string, Goal>() };
}

async function putAccount(vault: Vault, a: Account) {
  const { key: _key, ...rest } = a;
  await vault.putJson(a.key, rest satisfies StoredAccount);
}

/** Replace all data with a freshly built setup. Entries are written first, accounts last, so a
 *  crash in between leaves "no accounts" and setup simply runs again. */
export async function saveSetup(
  vault: Vault,
  accounts: ReadonlyMap<string, Account>,
  entries: ReadonlyMap<string, Entry>,
): Promise<void> {
  await vault.clearData();
  for (const [key, entry] of entries) await vault.putJson(key, entry);
  for (const a of accounts.values()) await putAccount(vault, a);
}

/** Replace all data with a complete set of books (used for the sample datasets). Accounts go last, as above. */
export async function saveAll(vault: Vault, data: LoadedData): Promise<void> {
  await vault.clearData();
  for (const [key, entry] of data.ledger.entries) await vault.putJson(key, entry);
  for (const [key, b] of data.budgets) await vault.putJson(key, b);
  for (const [key, g] of data.goals) await vault.putJson(key, g);
  for (const a of data.accounts.values()) await putAccount(vault, a);
}

/**
 * Save one confirmed entry (and any new accounts) encrypted, then add it to the in-memory ledger.
 * The ledger is only changed after the save succeeded, and new accounts are rolled back on failure.
 * Returns the entry's key.
 */
export async function commitEntry(
  vault: Vault,
  data: LoadedData,
  newAccounts: Account[],
  entry: Entry,
): Promise<string> {
  for (const a of newAccounts) data.accounts.set(a.key, a);
  try {
    const key = data.ledger.preview(entry);
    for (const a of newAccounts) await putAccount(vault, a);
    await vault.putJson(key, entry);
    data.ledger.append(entry);
    return key;
  } catch (e) {
    for (const a of newAccounts) data.accounts.delete(a.key);
    throw e;
  }
}

/** Save a Budget or Goal (and any new account it needs). Targets are settings, so they can be replaced. */
export async function commitTarget(
  vault: Vault,
  data: LoadedData,
  newAccounts: Account[],
  target: { kind: 'budget'; key: string; budget: Budget } | { kind: 'goal'; key: string; goal: Goal },
): Promise<void> {
  for (const a of newAccounts) data.accounts.set(a.key, a);
  try {
    for (const a of newAccounts) await putAccount(vault, a);
    if (target.kind === 'budget') {
      await vault.putJson(target.key, target.budget);
      data.budgets.set(target.key, target.budget);
    } else {
      await vault.putJson(target.key, target.goal);
      data.goals.set(target.key, target.goal);
    }
  } catch (e) {
    for (const a of newAccounts) data.accounts.delete(a.key);
    throw e;
  }
}

/**
 * Rename an account. Entries refer to accounts by key, so history is untouched (old notes keep the old
 * name as plain text). The app's own accounts cannot be renamed.
 */
export async function commitRename(vault: Vault, data: LoadedData, accountKey: string, newName: string): Promise<void> {
  const account = data.accounts.get(accountKey);
  if (!account) throw new Error('Unknown account.');
  if (account.system) throw new Error('This account is used by the app and cannot be renamed.');
  const name = newName.trim();
  if (name === '') throw new Error('Give the account a name.');
  const same = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if ([...data.accounts.values()].some((a) => a.key !== accountKey && same(a.name) === same(name))) {
    throw new Error('Another account already uses this name.');
  }
  const renamed = { ...account, name };
  await putAccount(vault, renamed);
  data.accounts.set(accountKey, renamed);
}

/** Post a Reversal of `key`, dated the same day as the original so period totals cancel exactly. */
export async function commitReversal(vault: Vault, data: LoadedData, key: string, reason: string): Promise<string> {
  const original = data.ledger.entries.get(key);
  if (!original) throw new Error(`Unknown entry ${key}`);
  const reversal = data.ledger.planReversal(key, original.date, reason);
  const rKey = data.ledger.preview(reversal);
  await vault.putJson(rKey, reversal);
  data.ledger.append(reversal);
  return rKey;
}

/**
 * Reverse `key` and post the corrected entry. The correction is checked before anything is saved.
 * If saving the correction fails after the reversal, the reversal stays (it is valid on its own) and
 * the error says so.
 */
export async function commitCorrection(
  vault: Vault,
  data: LoadedData,
  key: string,
  reason: string,
  newAccounts: Account[],
  corrected: Entry,
): Promise<{ reversal: string; correction: string }> {
  const original = data.ledger.entries.get(key);
  if (!original) throw new Error(`Unknown entry ${key}`);
  const entry: Entry = {
    ...corrected,
    kind: 'correction',
    correctionOf: key,
    note: `Correction of ${key}: ${corrected.note}`,
  };
  for (const a of newAccounts) data.accounts.set(a.key, a);
  try {
    data.ledger.preview(entry); // fail early, before anything is saved
    for (const a of newAccounts) await putAccount(vault, a);
    const reversal = await commitReversal(vault, data, key, reason);
    try {
      const cKey = data.ledger.preview(entry);
      await vault.putJson(cKey, entry);
      data.ledger.append(entry);
      return { reversal, correction: cKey };
    } catch (e) {
      throw new Error(`The original was reversed (${reversal}) but the correction could not be saved. Enter it again. ${e instanceof Error ? e.message : ''}`);
    }
  } catch (e) {
    if (!data.ledger.isReversed(key)) for (const a of newAccounts) data.accounts.delete(a.key);
    throw e;
  }
}

export async function loadAll(vault: Vault): Promise<LoadedData> {
  const accounts = new Map<string, Account>();
  const budgets = new Map<string, Budget>();
  const goals = new Map<string, Goal>();
  const entryRows: Array<[string, Entry]> = [];
  for (const key of await vault.keys()) {
    if (key.startsWith('acct:')) {
      const stored = await vault.getJson<StoredAccount>(key);
      if (stored) accounts.set(key, { key, ...stored });
    } else if (key.startsWith('txn:')) {
      const entry = await vault.getJson<Entry>(key);
      if (entry) entryRows.push([key, entry]);
    } else if (key.startsWith('budget:')) {
      const b = await vault.getJson<Budget>(key);
      if (b) budgets.set(key, b);
    } else if (key.startsWith('goal:')) {
      const g = await vault.getJson<Goal>(key);
      if (g) goals.set(key, g);
    }
  }
  const ledger = new Ledger(accounts);
  for (const [key, entry] of entryRows.sort(([a], [b]) => a.localeCompare(b))) ledger.load(key, entry);
  return { accounts, ledger, budgets, goals };
}
