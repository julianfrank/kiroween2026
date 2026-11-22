import { parseRupees, type Rupees } from '../money/money';

// The app, not the model, decides how much money a message mentions. Small models mis-convert units
// (they turned "30L" into 3 crore), so the model only copies the words and this module reads them.

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
const UNIT = '(?:k|thousand|l|lac|lakh|lakhs|cr|crore|crores)';

/** Remove dates and counts so their digits are not mistaken for money. */
function stripNonMoney(text: string): string {
  return text
    .replace(/\b\d{1,2}[/\-.](?:\d{1,2}|[a-z]{3,9})[/\-.]\d{4}\b/gi, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}(?:,?\\s*\\d{4})?`, 'gi'), ' ')
    .replace(new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?`, 'gi'), ' ')
    .replace(/\b\d+\s*(?:day|days|week|weeks|month|months|year|years|time|times|%|percent)\b/gi, ' ')
    .replace(/\b(?:in|during|of|year|fy)\s+(?:19|20)\d{2}\b/gi, ' ');
}

/**
 * Distinct amounts (whole rupees) found in the text, in order of first appearance.
 * Small bare numbers (under 100, no rupee sign or unit) are "weak": they are returned only when asked for,
 * because they are often counts ("take 2 bags").
 */
export function extractAmounts(message: string, includeWeak = false): Rupees[] {
  const text = stripNonMoney(message);
  const re = new RegExp(`(rs\\.?|inr|₹)?\\s*(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(${UNIT})?(?![a-z0-9])`, 'gi');
  const found: Rupees[] = [];
  for (const m of text.matchAll(re)) {
    const [, prefix, digits, unit] = m;
    const plain = digits.replace(/,/g, '');
    if (!prefix && !unit && Number(plain) < 100 && !includeWeak) continue;
    const value = parseRupees(`${digits}${unit ?? ''}`);
    if (value !== null && !found.includes(value)) found.push(value);
  }
  return found;
}

/**
 * Pick the amount text for the Confirm Card. The amount comes from the user's message only; the model's
 * text is used just to choose between several amounts the user actually wrote. A model that invents or
 * remembers a number (it once answered 100 crore to a message with no number) cannot put it on the card.
 * - One clear amount: use it. Several: use the model's pick only if it is one of them, else blank.
 * - None: a single small bare number ("paid 50 for tea") is used, otherwise blank so the user types it.
 */
export function chooseAmountText(message: string, modelText: string): string {
  const strong = extractAmounts(message);
  const fromModel = parseRupees(modelText.trim());
  if (strong.length === 1) return String(strong[0]);
  if (strong.length > 1) return fromModel !== null && strong.includes(fromModel) ? String(fromModel) : '';
  const weak = extractAmounts(message, true);
  if (weak.length === 1) return String(weak[0]);
  if (weak.length > 1) return fromModel !== null && weak.includes(fromModel) ? String(fromModel) : '';
  // An asset that is now worth nothing has no number in the message.
  return /^(₹|rs\.?|inr)?\s*0+$/i.test(modelText.trim()) && /\b(worthless|nothing|zero)\b/i.test(message) ? '0' : '';
}