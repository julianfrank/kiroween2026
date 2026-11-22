// The handwritten note under the title: a funny line about the user's real situation.
// `situation` reads the books; `pickQuip` chooses one true line at random.

import { monthRange } from '../dates/dates';
import { formatRupees, type Rupees } from '../money/money';
import type { LoadedData } from '../store/repo';
import { budgetProgress, goalProgress } from '../targets/progress';
import { netWorthState, type NetWorthState } from './theme';

export interface Situation {
  state: NetWorthState;
  netWorth: Rupees;
  assets: Rupees;
  liabilities: Rupees;
  /** This calendar month (IST), revaluations and opening balances left out. */
  income: Rupees;
  spent: Rupees;
  topExpense: { name: string; amount: Rupees } | null;
  /** Net revaluation this month: gains minus losses. */
  valuation: Rupees;
  overBudgets: Array<{ name: string; over: Rupees }>;
  nearBudgets: Array<{ name: string; percent: number }>;
  goalsReached: string[];
  goalsGoing: Array<{ name: string; percent: number }>;
}

export function situation(data: LoadedData, today: string): Situation {
  const accounts = [...data.accounts.values()];
  const sum = (kind: string) => accounts.filter((a) => a.kind === kind).reduce((s, a) => s + data.ledger.balance(a.key, today), 0);
  const assets = sum('asset');
  const liabilities = sum('liability');
  const netWorth = assets - liabilities;
  const { from } = monthRange(today);

  let income = 0;
  let spent = 0;
  let valuation = 0;
  let topExpense: Situation['topExpense'] = null;
  for (const a of accounts) {
    const moved = data.ledger.movement(a.key, from, today);
    if (moved === 0) continue;
    if (a.system === 'valuation-gain') valuation += moved;
    else if (a.system === 'valuation-loss') valuation -= moved;
    else if (a.kind === 'income') income += moved;
    else if (a.kind === 'expense') {
      spent += moved;
      if (!topExpense || moved > topExpense.amount) topExpense = { name: a.name, amount: moved };
    }
  }

  const budgets = [...data.budgets.values()].map((b) => ({ name: b.name, p: budgetProgress(b, data.ledger, today) }));
  const goals = [...data.goals.values()].map((g) => ({ name: g.name, p: goalProgress(g, data.ledger, today) }));
  return {
    state: netWorthState(netWorth, assets),
    netWorth,
    assets,
    liabilities,
    income,
    spent,
    topExpense,
    valuation,
    overBudgets: budgets.filter((b) => b.p.over).map((b) => ({ name: b.name, over: -b.p.remaining })),
    nearBudgets: budgets.filter((b) => b.p.near).map((b) => ({ name: b.name, percent: b.p.percent })),
    goalsReached: goals.filter((g) => g.p.done).map((g) => g.name),
    goalsGoing: goals.filter((g) => !g.p.done).map((g) => ({ name: g.name, percent: g.p.percent })),
  };
}

type Rng = () => number;
const pick = <T,>(xs: T[], rng: Rng): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const r = formatRupees;

/** Every line that is true for this situation. Each one names a real figure from the books. */
export function quips(s: Situation, rng: Rng = Math.random): string[] {
  const out: string[] = [];
  const nw = r(s.netWorth);

  if (s.state === 'dark') {
    out.push(
      `Net worth ${nw}. Even the ghosts have started lending you money.`,
      `Lights out at ${nw}. The bats are holding a fundraiser in your honour.`,
      `${nw} in the red. The vampires checked your account and left hungry.`,
      `The crypt says ${nw}. Time to stop feeding the money monsters.`,
    );
  } else if (s.state === 'twilight') {
    out.push(
      `Net worth ${nw}: riding a broomstick right along the line between black and red.`,
      `Dusk at ${nw}. One spooky purchase and the lights go out.`,
      `${nw}, so close to zero that the skeletons are taking bets.`,
    );
  } else {
    out.push(
      `Net worth ${nw}. The ghosts are jealous of your vault.`,
      `${nw} in the black. Your pumpkin is grinning for a reason.`,
      `${nw} and counting. Even the werewolves want your budgeting tips.`,
      `Comfortably ${nw} ahead. The haunted house is paid for (mostly).`,
    );
  }

  if (s.income > 0 && s.spent > 0) {
    const kept = s.income - s.spent;
    if (kept > 0) out.push(`You kept ${r(kept)} of this month's ${r(s.income)}. The piggy bank is cackling with joy.`);
    else out.push(`You spent ${r(-kept)} more than you earned this month. The cauldron is boiling over.`);
  } else if (s.spent > 0) {
    out.push(`${r(s.spent)} has flown out this month and nothing has flown in. Spooky.`);
  } else if (s.income === 0) {
    out.push('A quiet month in the crypt. Not a single coin has rattled yet.');
  }
  if (s.topExpense) {
    out.push(
      pick(
        [
          `Biggest bite this month: ${s.topExpense.name} at ${r(s.topExpense.amount)}. Was it a vampire?`,
          `${s.topExpense.name} swallowed ${r(s.topExpense.amount)} this month. Something lurks in that category.`,
        ],
        rng,
      ),
    );
  }
  for (const b of s.overBudgets) out.push(`The ${b.name} budget is haunted: ${r(b.over)} over this month. Something keeps eating it.`);
  for (const b of s.nearBudgets) out.push(`${b.name} is ${b.percent}% spent. Tread lightly, the floorboards creak.`);
  for (const g of s.goalsReached) out.push(`"${g}" reached! The skeletons are rattling in applause.`);
  for (const g of s.goalsGoing) {
    if (g.percent >= 50) out.push(`"${g.name}" is ${g.percent}% brewed. Keep stirring the cauldron.`);
    else out.push(`"${g.name}" is only ${g.percent}% there. The potion needs more coins.`);
  }
  if (s.valuation > 0) out.push(`Your things grew ${r(s.valuation)} in value this month. Magic? No, revaluation.`);
  if (s.valuation < 0) out.push(`A curse shrank your things by ${r(-s.valuation)} this month.`);
  if (s.assets > 0 && s.liabilities / s.assets >= 0.5) {
    out.push(`Debts are ${Math.round((s.liabilities / s.assets) * 100)}% of what you own. Can you hear the chains rattling?`);
  }
  if (s.liabilities === 0 && s.assets > 0) out.push('Not a single debt. No chains, no rattling, no ghosts at the door.');
  return out;
}

/** One line at random, never the same as the line before when another is available. */
export function pickQuip(s: Situation, rng: Rng = Math.random, previous = ''): string {
  const all = quips(s, rng);
  const fresh = all.filter((q) => q !== previous);
  return pick(fresh.length ? fresh : all, rng);
}

export const HOLD_MIN_MS = 120_000;
export const HOLD_MAX_MS = 240_000;

/** How long a finished note stays before the ghost writes the next one: 120 to 240 seconds at random. */
export function holdMs(rng: Rng = Math.random): number {
  return HOLD_MIN_MS + Math.round(rng() * (HOLD_MAX_MS - HOLD_MIN_MS));
}
