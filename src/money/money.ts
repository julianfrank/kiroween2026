// Money is whole rupees (integers). There are no paise anywhere in the app.

export type Rupees = number;

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
 * Parse text such as "Rs.5000", "₹ 5,000", "5k", "1.2L", "1.5 cr" into whole rupees.
 * A decimal is accepted only with a unit (k, L, cr) and only when the result is a whole number
 * of rupees. Plain decimals like "5000.50" are rejected. Returns null for anything else.
 */
export function parseRupees(text: string): Rupees | null {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/^(rs\.?|inr|₹)\s*/, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ');
  const m = /^(\d+)(?:\.(\d{1,2}))?\s*([a-z]+)?$/.exec(cleaned);
  if (!m) return null;
  const [, whole, fraction = '', unit] = m;
  let multiplier = 1;
  if (unit) {
    multiplier = MULTIPLIERS[unit] ?? 0;
    if (!multiplier) return null;
  } else if (fraction) {
    return null; // no paise
  }
  // Integer arithmetic only: whole*mult + fraction*mult/10^len, which must divide exactly.
  const scale = 10 ** fraction.length;
  const fractionPart = Number(fraction || '0') * multiplier;
  if (fractionPart % scale !== 0) return null;
  const rupees = Number(whole) * multiplier + fractionPart / scale;
  if (!Number.isSafeInteger(rupees) || rupees <= 0) return null;
  return rupees;
}

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** ₹1,20,000 style display (lakh/crore grouping), whole rupees only. */
export function formatRupees(rupees: Rupees): string {
  return formatter.format(rupees);
}
