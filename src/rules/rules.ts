import type { Rupees } from '../money/money';
import type { Account, Entry } from '../ledger/types';

/** Rules Engine: pure checks. Return a list of problems; empty means valid. */

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function validateEntry(entry: Entry, accounts: ReadonlyMap<string, Account>): string[] {
  const problems: string[] = [];
  if (!isValidDate(entry.date)) problems.push(`Invalid date "${entry.date}"`);
  if (entry.note.trim() === '') problems.push('Every entry needs a note');
  if (entry.lines.length < 2) problems.push('An entry needs at least two lines');

  let debits = 0;
  let credits = 0;
  for (const line of entry.lines) {
    if (!accounts.has(line.account)) problems.push(`Unknown account ${line.account}`);
    const okAmount = (n: number) => Number.isSafeInteger(n) && n >= 0;
    if (!okAmount(line.debitRupees) || !okAmount(line.creditRupees)) {
      problems.push('Amounts must be whole Rupees, not negative');
      continue;
    }
    const sides = Number(line.debitRupees > 0) + Number(line.creditRupees > 0);
    if (sides !== 1) problems.push('Each line must have exactly one of debit or credit');
    debits += line.debitRupees;
    credits += line.creditRupees;
  }
  if (debits !== credits) problems.push(`Debits (${debits}) must equal credits (${credits})`);
  if (debits === 0) problems.push('Entry total must be above zero');

  if (entry.kind === 'reversal' && !entry.reverses) problems.push('A reversal must say what it reverses');
  if (entry.kind === 'correction' && !entry.correctionOf) {
    problems.push('A correction must say what it corrects');
  }
  return problems;
}

/** Setup gate: Assets = Liabilities + Opening Equity. Positive imbalance means assets are too high. */
export function setupImbalance(totals: {
  assets: Rupees;
  liabilities: Rupees;
  equity: Rupees;
}): Rupees {
  return totals.assets - (totals.liabilities + totals.equity);
}

export function isSetupBalanced(totals: { assets: Rupees; liabilities: Rupees; equity: Rupees }): boolean {
  return setupImbalance(totals) === 0;
}
