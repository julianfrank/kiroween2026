import { parseDisplayDate } from './dates';

// Deterministic resolver for the date words a user types or the model copies. Pure: "today" is injected
// (an IST ISO date), so tests never depend on the clock.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function utc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}
function weekdayIndex(iso: string): number {
  return utc(iso).getUTCDay();
}
function monthIndex(word: string): number {
  if (word.length < 3) return -1;
  return MONTHS.findIndex((m) => word.startsWith(m));
}
function build(y: number, m: number, d: number): string | null {
  return parseDisplayDate(`${d}/${m}/${y}`);
}

/** Returns an ISO date (YYYY-MM-DD) or null when the phrase is not understood. */
export function resolveDatePhrase(text: string, today: string): string | null {
  const t = text.trim().toLowerCase().replace(/^on\s+/, '').replace(/[.,]$/, '');
  if (t === '') return null;

  const exact = parseDisplayDate(t);
  if (exact) return exact;

  if (t === 'today' || t === 'now' || t === 'tonight') return today;
  if (t === 'yesterday') return addDays(today, -1);
  if (t === 'day before yesterday') return addDays(today, -2);
  if (t === 'tomorrow') return addDays(today, 1);

  const ago = /^(\d+|[a-z]+)\s+(day|week)s?\s+ago$/.exec(t);
  if (ago) {
    const n = /^\d+$/.test(ago[1]) ? Number(ago[1]) : NUMBER_WORDS[ago[1]];
    if (n === undefined) return null;
    return addDays(today, -n * (ago[2] === 'week' ? 7 : 1));
  }

  const lastWeekday = /^(?:last|previous)\s+([a-z]+)$/.exec(t);
  if (lastWeekday && WEEKDAYS.includes(lastWeekday[1])) {
    const target = WEEKDAYS.indexOf(lastWeekday[1]);
    const diff = ((weekdayIndex(today) - target + 7) % 7) || 7; // strictly before today
    return addDays(today, -diff);
  }

  const plainWeekday = /^(?:this\s+)?([a-z]+)$/.exec(t);
  if (plainWeekday && WEEKDAYS.includes(plainWeekday[1])) {
    const target = WEEKDAYS.indexOf(plainWeekday[1]);
    return addDays(today, -((weekdayIndex(today) - target + 7) % 7)); // most recent, today included
  }

  const year = Number(today.slice(0, 4));
  const withYear = (d: number, m: number, y?: number): string | null => {
    if (m < 0) return null;
    if (y !== undefined) return build(y, m + 1, d);
    const candidate = build(year, m + 1, d);
    if (candidate && candidate > today) return build(year - 1, m + 1, d); // no year given: the latest past one
    return candidate;
  };

  const dayMonth = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)(?:,?\s*(\d{4}))?$/.exec(t);
  if (dayMonth) return withYear(Number(dayMonth[1]), monthIndex(dayMonth[2]), dayMonth[3] ? Number(dayMonth[3]) : undefined);

  const monthDay = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/.exec(t);
  if (monthDay) return withYear(Number(monthDay[2]), monthIndex(monthDay[1]), monthDay[3] ? Number(monthDay[3]) : undefined);

  return null;
}
