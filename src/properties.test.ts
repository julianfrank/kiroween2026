// Property-based tests for the core money rules. Each property names the requirement it protects
// (see .kiro/specs/scary-money-manager/requirements.md and tasks.md). fast-check generates the inputs.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chooseAmountText, extractAmounts } from './chat/amounts';
import { blankDraft, resolveDraft, type ResolveContext } from './chat/draft';
import type { IntentId } from './chat/intents';
import { todayIso } from './dates/dates';
import { addDays } from './dates/resolve';
import { exportWithCurrentPassword, importExportFile } from './export/format';
import { Ledger } from './ledger/ledger';
import type { Account, Entry } from './ledger/types';
import { formatRupees, parseRupees } from './money/money';
import { buildSetup, evaluateDraft, type DraftRow } from './setup/setup';
import { MemoryKV } from './store/kv';
import { saveAll } from './store/repo';
import { WrongPasswordError, createVault } from './store/vault';
import { netWorthState } from './theme/theme';

const TODAY = '2026-11-22';
const MAX_RUPEES = 10_000_000_000_000; // ₹1 lakh crore: far above any household figure

function row(i: number, over: Partial<DraftRow>): DraftRow {
  return { id: `r${i}`, kind: 'asset', category: null, name: `Account ${i}`, amountText: '', asOfText: '01/Jan/2026', ...over };
}

/** Small books with every kind of account the chat uses. */
function books() {
  const rows = [
    row(1, { name: 'Cash', amountText: '1,00,000' }),
    row(2, { name: 'Bank', amountText: '5L' }),
    row(3, { name: 'Savings', amountText: '50,000', category: 'savings' }),
    row(4, { kind: 'liability', name: 'Loan - Tom', amountText: '20,000' }),
  ];
  const first = evaluateDraft(rows, '', TODAY);
  const ev = evaluateDraft(rows, String(first.assets - first.liabilities), TODAY);
  return buildSetup(ev.lines, ev.equity, TODAY);
}

/** For each intent: the accounts it may use, and what it does to net worth. */
const MOVES: Record<string, { from: string[]; to: string[]; netWorth: (amount: number) => number }> = {
  income: { from: ['Salary', 'Other Income'], to: ['Cash', 'Bank', 'Savings'], netWorth: (a) => a },
  expense: { from: ['Cash', 'Bank', 'Savings'], to: ['Food', 'Rent', 'Transport', 'Utilities', 'Other Expense'], netWorth: (a) => -a },
  transfer: { from: ['Cash', 'Bank', 'Savings'], to: ['Cash', 'Bank', 'Savings'], netWorth: () => 0 },
  borrow: { from: ['Loan - Tom'], to: ['Cash', 'Bank'], netWorth: () => 0 },
  repay: { from: ['Cash', 'Bank'], to: ['Loan - Tom'], netWorth: () => 0 },
};

const arbMove = fc
  .record({
    intent: fc.constantFrom(...Object.keys(MOVES)),
    amount: fc.integer({ min: 1, max: 50_000_000 }),
    daysAgo: fc.integer({ min: 0, max: 60 }),
    fromPick: fc.nat(),
    toPick: fc.nat(),
  })
  .map((m) => {
    const rule = MOVES[m.intent];
    const from = rule.from[m.fromPick % rule.from.length];
    const others = rule.to.filter((t) => t !== from);
    return { ...m, from, to: others[m.toPick % others.length] };
  });

function ctxFor(accounts: ReadonlyMap<string, Account>, ledger: Ledger): ResolveContext {
  return { accounts, today: TODAY, balanceOf: (k) => ledger.balance(k) };
}

interface Move {
  intent: string;
  amount: number;
  daysAgo: number;
  from: string;
  to: string;
}

function entryFor(m: Move, accounts: ReadonlyMap<string, Account>, ledger: Ledger): Entry {
  const r = resolveDraft(
    { ...blankDraft('property test'), intent: m.intent as IntentId, amountText: String(m.amount), dateText: addDays(TODAY, -m.daysAgo), fromName: m.from, toName: m.to, source: 'manual-form' },
    ctxFor(accounts, ledger),
  );
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' '));
  return r.entry;
}

describe('properties of the money rules', () => {
  it('every entry the app builds balances, and changes net worth by exactly what its kind says [Q2, Q11, ledger rules]', () => {
    fc.assert(
      fc.property(arbMove, (m) => {
        const { accounts, ledger } = books();
        const before = ledger.netWorth(TODAY);
        const e = entryFor(m, accounts, ledger);
        const debits = e.lines.reduce((s, l) => s + l.debitRupees, 0);
        const credits = e.lines.reduce((s, l) => s + l.creditRupees, 0);
        expect(debits).toBe(credits);
        expect(debits).toBe(m.amount);
        for (const l of e.lines) expect(Number(l.debitRupees > 0) + Number(l.creditRupees > 0)).toBe(1);
        ledger.append(e);
        expect(ledger.netWorth(TODAY) - before).toBe(MOVES[m.intent].netWorth(m.amount));
      }),
      { numRuns: 300 },
    );
  });

  it('reversing any set of entries gives the same balances as never having posted them [Q11, append-only ledger]', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(arbMove, fc.boolean()), { minLength: 1, maxLength: 25 }), (moves) => {
        const a = books();
        const b = books();
        for (const [m, reverseIt] of moves) {
          const key = a.ledger.append(entryFor(m, a.accounts, a.ledger));
          if (reverseIt) a.ledger.reverse(key, addDays(TODAY, -m.daysAgo), 'property test');
          else b.ledger.append(entryFor(m, b.accounts, b.ledger));
        }
        // The two books have different account keys, so compare balances by account name.
        const byName = (d: { accounts: ReadonlyMap<string, Account>; ledger: Ledger }) =>
          Object.fromEntries([...d.accounts.values()].map((acc) => [acc.name, d.ledger.balance(acc.key)]));
        expect(byName(a)).toEqual(byName(b));
        expect(a.ledger.netWorth()).toBe(b.ledger.netWorth());
      }),
      { numRuns: 150 },
    );
  });

  it('a rupee amount survives formatting and parsing, and paise are always refused [Q10]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_RUPEES }), fc.integer({ min: 1, max: 99 }), (rupees, paise) => {
        expect(parseRupees(formatRupees(rupees))).toBe(rupees);
        expect(parseRupees(String(rupees))).toBe(rupees);
        expect(parseRupees(`${rupees}.${String(paise).padStart(2, '0')}`)).toBeNull();
        expect(formatRupees(rupees)).not.toMatch(/\.\d/);
      }),
      { numRuns: 1000 },
    );
  });

  it('the app reads the amount from a sentence however the user writes it, and ignores dates and counts [Q2, the 30L bug]', () => {
    // Write the same amount the ways people type it: 50000, 50,000, ₹50,000, Rs.50000, Rs 50k, 0.5L, 1.2 cr.
    const written = fc.integer({ min: 100, max: 5_000_000_000 }).chain((rupees) => {
      const forms: string[] = [String(rupees), new Intl.NumberFormat('en-IN').format(rupees), formatRupees(rupees), `Rs.${rupees}`, `Rs ${rupees}`];
      const unit = (size: number, names: string[]) => {
        if (rupees % (size / 100) !== 0) return; // only units that give whole rupees with up to 2 decimals
        const v = rupees / size;
        const text = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
        if (parseFloat(text) * size !== rupees) return;
        for (const n of names) forms.push(`${text}${n}`, `${text} ${n}`);
      };
      unit(1_000, ['k']);
      unit(100_000, ['L', 'lakh']);
      unit(10_000_000, ['cr', 'crore']);
      return fc.tuple(fc.constant(rupees), fc.constantFrom(...forms));
    });
    const dates = fc.constantFrom('', ' yesterday', ' on 3 Nov', ' on 22/Nov/2026', ' 3 days ago', ' in Dec 2027', ' last Friday');
    fc.assert(
      fc.property(written, dates, fc.constantFrom('Paid', 'Spent', 'Got', 'Borrowed', 'Moved'), ([rupees, form], when, verb) => {
        const sentence = `${verb} ${form} for 2 tickets${when}`;
        expect(extractAmounts(sentence)).toEqual([rupees]);
        // Even when the model reports a different number, the card shows the user's amount.
        expect(chooseAmountText(sentence, String(rupees * 10))).toBe(String(rupees));
      }),
      { numRuns: 2000 },
    );
  });

  it('setup opens if and only if Assets = Liabilities + Opening Equity [Q1, Q24]', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1_000_000_000 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 1_000_000_000 }), { maxLength: 4 }),
        fc.integer({ min: -3_000_000_000, max: 5_000_000_000 }),
        (assets, liabilities, equity) => {
          const rows = [
            ...assets.map((a, i) => row(i, { name: `Asset ${i}`, amountText: String(a) })),
            ...liabilities.map((l, i) => row(100 + i, { kind: 'liability', name: `Debt ${i}`, amountText: String(l) })),
          ];
          const ev = evaluateDraft(rows, String(equity), TODAY);
          const sumA = assets.reduce((s, x) => s + x, 0);
          const sumL = liabilities.reduce((s, x) => s + x, 0);
          const balanced = sumA === sumL + equity;
          expect(ev.imbalance).toBe(sumA - (sumL + equity));
          expect(ev.canContinue).toBe(balanced);
          if (balanced) expect(buildSetup(ev.lines, ev.equity, TODAY).ledger.netWorth()).toBe(equity);
          else expect(() => buildSetup(ev.lines, ev.equity, TODAY)).toThrow(/not balanced/);
          // "Use difference" always balances it.
          expect(evaluateDraft(rows, String(sumA - sumL), TODAY).canContinue).toBe(true);
        },
      ),
      { numRuns: 400 },
    );
  });

  it('the Net Worth State boundaries hold for any figures [Q19, Q20]', () => {
    fc.assert(
      fc.property(fc.integer({ min: -MAX_RUPEES, max: MAX_RUPEES }), fc.integer({ min: -MAX_RUPEES, max: MAX_RUPEES }), (nw, assets) => {
        const state = netWorthState(nw, assets);
        const band = Math.max(0, assets) * 0.05;
        if (Math.abs(nw) <= band) expect(state).toBe('twilight');
        else expect(state).toBe(nw > 0 ? 'light' : 'dark');
        // No memory: the same numbers always give the same state.
        expect(netWorthState(nw, assets)).toBe(state);
      }),
      { numRuns: 2000 },
    );
  });

  it('"today" is always the IST calendar date, whatever the moment [dates in IST]', () => {
    fc.assert(
      fc.property(fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2100-01-01T00:00:00Z'), noInvalidDate: true }), (d) => {
        const ist = new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
        expect(todayIso(d)).toBe(ist);
      }),
      { numRuns: 1000 },
    );
  });

  it('export then import keeps the books exactly; a wrong password changes nothing [Q13, Q17]', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbMove, { maxLength: 8 }), fc.string({ minLength: 7, maxLength: 20 }), async (moves, password) => {
        const { accounts, ledger } = books();
        for (const m of moves) ledger.append(entryFor(m, accounts, ledger));
        const kv = new MemoryKV();
        const vault = await createVault(kv, password, 100_000);
        await saveAll(vault, { accounts, ledger, budgets: new Map(), goals: new Map() });
        const file = JSON.stringify(await exportWithCurrentPassword(kv, vault));

        const other = new MemoryKV();
        const otherVault = await createVault(other, 'someone-else', 100_000);
        await saveAll(otherVault, { ...books(), budgets: new Map(), goals: new Map() });
        const before = JSON.stringify([...other.data].sort());
        await expect(importExportFile(other, file, `${password}!`, () => {})).rejects.toBeInstanceOf(WrongPasswordError);
        expect(JSON.stringify([...other.data].sort())).toBe(before);

        const { data } = await importExportFile(other, file, password, () => {});
        expect(data.ledger.netWorth()).toBe(ledger.netWorth());
        expect(data.ledger.entries.size).toBe(ledger.entries.size);
      }),
      { numRuns: 6 },
    );
  }, 120_000);
});

