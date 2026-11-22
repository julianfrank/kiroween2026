import { describe, expect, it } from 'vitest';
import { AiHost, contextFill } from '../ai/host';
import type { SessionLike } from '../ai/readiness';
import type { PromptHost } from '../chat/proposal';
import { GOLDEN, formatReport, idealReply, runGolden } from './golden';

function hostFrom(reply: (input: string) => string): PromptHost {
  return { prompt: async (input) => reply(input) };
}

/** Finds the case a prompt is about, from the quoted message at the end of the prompt. */
function caseOf(input: string) {
  const c = GOLDEN.find((g) => input.includes(`Message: ${JSON.stringify(g.message)}`));
  if (!c) throw new Error('unknown prompt');
  return c;
}

describe('golden sentences', () => {
  it('has 30 to 50 cases covering every chat tab, redirects and non-events', () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(30);
    expect(GOLDEN.length).toBeLessThanOrEqual(50);
    for (const tab of ['daily', 'assets', 'liabilities', 'goals', 'budgets']) expect(GOLDEN.some((g) => g.tab === tab)).toBe(true);
    expect(GOLDEN.some((g) => 'redirect' in g.expect)).toBe(true);
    expect(GOLDEN.some((g) => 'other' in g.expect)).toBe(true);
    expect(new Set(GOLDEN.map((g) => g.message)).size).toBe(GOLDEN.length);
  });

  it('a model that answers perfectly scores 100%, so every expectation is reachable', async () => {
    const report = await runGolden(hostFrom((input) => idealReply(caseOf(input))));
    const failures = report.results.filter((r) => !r.pass);
    expect(formatReport({ ...report, results: failures })).toBe(formatReport({ ...report, results: [] }));
    expect(report.passed).toBe(report.total);
  });

  it('scores mistakes field by field and lists them for the report', async () => {
    // A model that calls everything an expense from Cash to Food, dated "someday".
    const bad = hostFrom(() => JSON.stringify({ intent: 'expense', amount: '1', date: 'someday', fromAccount: 'Cash', toAccount: 'Food' }));
    let progress = 0;
    const report = await runGolden(bad, (done) => (progress = done));
    expect(progress).toBe(GOLDEN.length);
    expect(report.passed).toBeLessThan(report.total / 2);
    const text = formatReport(report, 'Chrome 142');
    expect(text).toMatch(/^Golden sentences: \d+ of 36 passed \(\d+%\), Chrome 142/);
    expect(text).toContain('Failures:');
    expect(text).toContain('[liabilities] "I\'ve taken a Loan of Rs.5000 from Tom"');
    expect(text).toContain('intent: expected borrow, got');
    expect(text).toContain('model said: {"intent":"expense"'); // the exact reply, for diagnosing
    // The app reads amounts from the message, so even this model gets most amounts right.
    expect(report.byField.amount[0]).toBeGreaterThan(report.byField.amount[1] / 2);
  });

  it('an AI error counts as a failure and the run continues', async () => {
    const failing: PromptHost = { prompt: async () => Promise.reject(new Error('session destroyed')) };
    const report = await runGolden(failing);
    expect(report.passed).toBe(0);
    expect(report.results).toHaveLength(GOLDEN.length);
  });
});

function session(used: Record<string, number>): SessionLike & { destroyed: boolean } {
  return { ...used, destroyed: false, prompt: async () => 'ok', destroy() { this.destroyed = true; } } as SessionLike & { destroyed: boolean };
}

describe('context rebuild', () => {
  it('reads both the current and the older names for context usage', () => {
    expect(contextFill(session({ contextUsage: 40, contextWindow: 100 }))).toBe(0.4);
    expect(contextFill(session({ inputUsage: 90, inputQuota: 100 }))).toBe(0.9);
    expect(contextFill(session({}))).toBeNull();
  });

  it('a long chat keeps working: the session is rebuilt each time it reaches 80%', async () => {
    let made = 0;
    const sessions: Array<SessionLike & { destroyed: boolean; used: number }> = [];
    const make = async () => {
      made++;
      const s = {
        destroyed: false,
        used: 0,
        contextWindow: 1000,
        get contextUsage() { return this.used; },
        async prompt(input: string) {
          if (this.destroyed) throw Object.assign(new Error('destroyed'), { name: 'InvalidStateError' });
          this.used += input.length;
          return 'ok';
        },
        destroy() { this.destroyed = true; },
      };
      sessions.push(s);
      return s;
    };
    const host = new AiHost(make);
    host.adopt(await make());
    for (let i = 0; i < 40; i++) await expect(host.prompt('x'.repeat(100))).resolves.toBe('ok');
    expect(host.rebuilds).toBeGreaterThanOrEqual(4);
    expect(sessions.slice(0, -1).every((s) => s.destroyed)).toBe(true);
    expect(sessions.at(-1)!.destroyed).toBe(false);
    expect(made).toBe(host.rebuilds + 1);
  });

  it('recovers once from a context overflow error', async () => {
    let first = true;
    const overflow: SessionLike = {
      prompt: async () => {
        if (first) { first = false; throw Object.assign(new Error('too long'), { name: 'QuotaExceededError' }); }
        return 'never';
      },
      destroy: () => {},
    };
    const host = new AiHost(async () => session({}));
    host.adopt(overflow);
    await expect(host.prompt('hi')).resolves.toBe('ok');
    expect(host.rebuilds).toBe(1);
  });
});
