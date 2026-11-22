// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIso } from '../dates/dates';
import { buildSample } from '../sample/sample';
import { CHAR_MS, ERASE_MS, GhostNote } from './GhostNote';
import { HOLD_MAX_MS, HOLD_MIN_MS, holdMs, pickQuip, quips, situation } from './quips';

describe('quips', () => {
  const today = todayIso();
  const neg = situation(buildSample('negative', today), today);
  const pos = situation(buildSample('positive', today), today);

  it('read the real situation', () => {
    expect(neg.state).toBe('dark');
    expect(pos.state).toBe('light');
    expect(neg.netWorth).toBeLessThan(0);
    expect(pos.goalsGoing.length + pos.goalsReached.length).toBe(2);
  });

  it('only say things that are true, with the real figures', () => {
    const n = quips(neg).join('\n');
    expect(n).toContain('-₹1,02,050');
    expect(n).not.toMatch(/jealous of your vault|in the black/);
    const p = quips(pos).join('\n');
    expect(p).toContain('₹8,90,401');
    expect(p).not.toMatch(/Lights out|in the red/);
    expect(p).toMatch(/Emergency fund/);
  });

  it('never repeat the previous line when another is available', () => {
    const lines = quips(pos);
    for (let i = 0; i < lines.length; i++) {
      const rng = () => i / lines.length;
      const first = pickQuip(pos, rng);
      expect(pickQuip(pos, rng, first)).not.toBe(first);
    }
  });

  it('wait between 120 and 240 seconds', () => {
    expect(holdMs(() => 0)).toBe(HOLD_MIN_MS);
    expect(holdMs(() => 0.999999)).toBeLessThanOrEqual(HOLD_MAX_MS);
    expect(HOLD_MIN_MS).toBe(120_000);
    expect(HOLD_MAX_MS).toBe(240_000);
  });
});

describe('GhostNote', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const ink = (c: HTMLElement) => [...c.querySelectorAll('.ghost-note-ink .ink')].map((s) => s.textContent).join('');
  /** Advance the clock in small steps so each scheduled letter gets its turn. */
  const run = (ms: number, step = CHAR_MS) => {
    for (let t = 0; t < ms; t += step) act(() => vi.advanceTimersByTime(step));
  };
  const spoken = (c: HTMLElement) => c.querySelector('.ghost-note [aria-live]')!.textContent;

  it('a ghost writes the line letter by letter, then rests, then writes a new one after the random wait', () => {
    let n = 0;
    const rng = () => [0.1, 0.5, 0.9, 0.3][n++ % 4];
    const data = buildSample('positive', todayIso());
    const { container } = render(<GhostNote data={data} rng={rng} />);
    expect(ink(container)).toBe('');
    expect(container.querySelector('.ghost-scribe .quill')).not.toBeNull();

    run(CHAR_MS * 5);
    expect(ink(container).length).toBe(5);
    expect(spoken(container)).toBe(''); // screen readers hear it once, complete

    run(CHAR_MS * 400);
    const first = ink(container);
    expect(first.length).toBeGreaterThan(20);
    expect(spoken(container)).toBe(first);
    expect(container.querySelector('.ghost-scribe.resting')).not.toBeNull();

    run(HOLD_MIN_MS - 1000, 1000); // still resting before the minimum wait
    expect(ink(container)).toBe(first);
    run(HOLD_MAX_MS - HOLD_MIN_MS + 1000, 1000);
    expect(container.querySelector('.ghost-note.phase-erasing, .ghost-note.phase-writing')).not.toBeNull();
    run(ERASE_MS + CHAR_MS * 400);
    expect(ink(container)).not.toBe(first);
  });

  it('rewrites at once when the Net Worth State changes', () => {
    const today = todayIso();
    const { container, rerender } = render(<GhostNote data={buildSample('positive', today)} />);
    run(CHAR_MS * 400);
    expect(container.querySelector('.ghost-note')!.getAttribute('data-state')).toBe('light');
    rerender(<GhostNote data={buildSample('negative', today)} />);
    expect(container.querySelector('.ghost-note')!.getAttribute('data-state')).toBe('dark');
    expect(ink(container)).toBe(''); // started again from the first letter
    run(CHAR_MS * 400);
    expect(quips(situation(buildSample('negative', today), today))).toContain(ink(container));
  });
});
