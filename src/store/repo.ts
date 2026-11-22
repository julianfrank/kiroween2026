import type { Account, Entry } from '../ledger/types';
import { Ledger } from '../ledger/ledger';
import type { Vault } from './vault';

type StoredAccount = Omit<Account, 'key'>;

export interface LoadedData {
  accounts: Map<string, Account>;
  ledger: Ledger;
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
  for (const [key, account] of accounts) {
    const { key: _key, ...rest } = account;
    await vault.putJson(key, rest satisfies StoredAccount);
  }
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
    for (const a of newAccounts) {
      const { key: _key, ...rest } = a;
      await vault.putJson(a.key, rest satisfies StoredAccount);
    }
    await vault.putJson(key, entry);
    data.ledger.append(entry);
    return key;
  } catch (e) {
    for (const a of newAccounts) data.accounts.delete(a.key);
    throw e;
  }
}

export async function loadAll(vault: Vault): Promise<LoadedData> {
  const accounts = new Map<string, Account>();
  const entryRows: Array<[string, Entry]> = [];
  for (const key of await vault.keys()) {
    if (key.startsWith('acct:')) {
      const stored = await vault.getJson<StoredAccount>(key);
      if (stored) accounts.set(key, { key, ...stored });
    } else if (key.startsWith('txn:')) {
      const entry = await vault.getJson<Entry>(key);
      if (entry) entryRows.push([key, entry]);
    }
  }
  const ledger = new Ledger(accounts);
  for (const [key, entry] of entryRows.sort(([a], [b]) => a.localeCompare(b))) ledger.load(key, entry);
  return { accounts, ledger };
}
