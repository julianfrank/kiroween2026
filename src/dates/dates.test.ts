import { describe, expect, it } from 'vitest';
import { formatDate, parseDisplayDate, todayIso } from './dates';

describe('dates (IST, DD/MMM/YYYY)', () => {
  it('formats ISO dates as DD/MMM/YYYY', () => {
    expect(formatDate('2026-11-22')).toBe('22/Nov/2026');
    expect(formatDate('2000-05-01')).toBe('01/May/2000');
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('parses typed dates and rejects impossible ones', () => {
    expect(parseDisplayDate('22/Nov/2026')).toBe('2026-11-22');
    expect(parseDisplayDate('1-feb-2024')).toBe('2024-02-01');
    expect(parseDisplayDate('29/Feb/2024')).toBe('2024-02-29');
    expect(parseDisplayDate('29/Feb/2025')).toBeNull();
    expect(parseDisplayDate('31/Apr/2026')).toBeNull();
    expect(parseDisplayDate('10/Foo/2026')).toBeNull();
    expect(parseDisplayDate('')).toBeNull();
  });

  it('today is the IST calendar date, not the machine or UTC date', () => {
    // 20:00 UTC on 21 Nov is 01:30 IST on 22 Nov.
    expect(todayIso(new Date('2026-11-21T20:00:00Z'))).toBe('2026-11-22');
    // 18:29 UTC is still 23:59 IST on the same day.
    expect(todayIso(new Date('2026-11-21T18:29:00Z'))).toBe('2026-11-21');
    // 18:30 UTC is midnight IST.
    expect(todayIso(new Date('2026-11-21T18:30:00Z'))).toBe('2026-11-22');
  });
});
