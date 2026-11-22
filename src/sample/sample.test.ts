import { describe, expect, it } from 'vitest';
import { goalProgress, budgetProgress } from '../targets/progress';
import { exportWithCurrentPassword, openExport, parseEnvelope } from '../export/format';
import { MemoryKV } from '../store/kv';
import { loadAll, saveAll } from '../store/repo';
import { createVault } from '../store/vault';
import { netWorthState } from '../theme/theme';
import { buildSample, type SampleKind } from './sample';

const DAYS = ['2026-11-22', '2026-01-01', '2024-02-29', '2026-03-31', '2026-12-31'];

function totals(data: ReturnType<typeof buildSample>, today: string) {
  const accounts = [...data.accounts.values()];
  const assets = accounts.filter((a) => a.kind === 'asset').reduce((s, a) => s + data.ledger.balance(a.key, today), 0);
  return { assets, netWorth: data.ledger.netWorth(today) };
}

describe.each(DAYS)('sample datasets built on %s', (today) => {
  it.each<SampleKind>(['negative', 'positive'])('%s: 25 transactions, dated up to today, touching every tab', (kind) => {
    const data = buildSample(kind, today);
    const entries = [...data.ledger.entries.values()];
    const activity = entries.filter((e) => e.kind !== 'opening');
    expect(activity).toHaveLength(25);
    expect(activity.every((e) => e.date <= today)).toBe(true);
    expect(activity.some((e) => e.date === today)).toBe(true);
    // Daily Updates, Assets and Liabilities all have entries of their own kinds.
    const intents = new Set(activity.map((e) => e.intent));
    for (const i of ['income', 'expense', 'transfer', 'borrow', 'repay', 'revalue']) expect(intents.has(i as never)).toBe(true);
    expect(activity.some((e) => e.kind === 'revaluation')).toBe(true);
    // Budgets and Goals have targets, and their progress comes from the entries.
    expect(data.budgets.size).toBeGreaterThan(0);
    expect(data.goals.size).toBeGreaterThan(0);
    for (const g of data.goals.values()) expect(goalProgress(g, data.ledger, today).saved).toBeGreaterThan(0);
    expect([...data.budgets.values()].some((b) => budgetProgress(b, data.ledger, today).spent > 0)).toBe(true);
    // Every account the samples use is a real one, and loans are liabilities.
    for (const a of data.accounts.values()) if (/loan|credit card/i.test(a.name)) expect(a.kind).toBe('liability');
  });

  it('the negative sample ends below zero (Dark), the positive one above zero (Light)', () => {
    const neg = totals(buildSample('negative', today), today);
    expect(neg.netWorth).toBeLessThan(0);
    expect(netWorthState(neg.netWorth, neg.assets)).toBe('dark');
    const pos = totals(buildSample('positive', today), today);
    expect(pos.netWorth).toBeGreaterThan(0);
    expect(netWorthState(pos.netWorth, pos.assets)).toBe('light');
  });
});

describe('saving a sample', () => {
  it('is stored encrypted, loads back the same, and exports as a valid file', async () => {
    const data = buildSample('negative', '2026-11-22');
    const kv = new MemoryKV();
    const vault = await createVault(kv, 'sample-pw', 100_000);
    await saveAll(vault, data);
    expect([...kv.data.values()].join('\n')).not.toContain('Hospital');
    const loaded = await loadAll(vault);
    expect(loaded.ledger.entries.size).toBe(data.ledger.entries.size);
    expect(loaded.ledger.netWorth()).toBe(data.ledger.netWorth());
    expect(loaded.budgets.size).toBe(data.budgets.size);
    expect(loaded.goals.size).toBe(data.goals.size);
    const opened = await openExport(parseEnvelope(JSON.stringify(await exportWithCurrentPassword(kv, vault))), 'sample-pw');
    expect(opened.data.ledger.netWorth()).toBe(data.ledger.netWorth());
  });
});
