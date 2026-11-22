// Money is integer paise. Never use floating point for stored amounts.

export type Paise = number;

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  l: 100_000,
  lac: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
};

/**
 * Parse text such as "Rs.5000", "₹ 5,000", "1,20,000.50", "5k", "1.2L", "1.5 cr" into paise.
 * Returns null when the text is not a single positive amount.
 */
export function parseRupees(text: string): Paise | null {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/^(rs\.?|inr|₹)\s*/, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ');
  const m = /^(\d+)(?:\.(\d{1,2}))?\s*([a-z]+)?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number(m[1]);
  const fraction = m[2] ? Number(m[2].padEnd(2, '0')) : 0;
  let multiplier = 1;
  if (m[3]) {
    multiplier = MULTIPLIERS[m[3]] ?? 0;
    if (!multiplier) return null;
  }
  // Work in paise as integers: (whole*100 + fraction) * multiplier, with the fraction scaled safely.
  const paise = whole * 100 * multiplier + Math.round((fraction * multiplier) / 1);
  if (!Number.isSafeInteger(paise) || paise <= 0) return null;
  return paise;
}

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** ₹1,20,000 style display (lakh/crore grouping). Shows paise only when non-zero. */
export function formatPaise(paise: Paise): string {
  const rupees = Math.trunc(paise / 100);
  const rest = Math.abs(paise % 100);
  if (rest === 0) return formatter.format(rupees);
  const sign = paise < 0 ? '-' : '';
  return `${sign}${formatter.format(Math.abs(rupees))}.${String(rest).padStart(2, '0')}`;
}
