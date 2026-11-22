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
    .replace(/\b\d+\s*(?:day|days|week|weeks|month|months|year|years|time|times|%|percent)\b/gi, ' ');
}

/** Distinct amounts (whole rupees) found in the text, in order of first appearance. */
export function extractAmounts(message: string): Rupees[] {
  const text = stripNonMoney(message);
  const re = new RegExp(`(rs\\.?|inr|₹)?\\s*(\\d[\\d,]*(?:\\.\\d{1,2})?)\\s*(${UNIT})?(?![a-z0-9])`, 'gi');
  const found: Rupees[] = [];
  for (const m of text.matchAll(re)) {
    const [, prefix, digits, unit] = m;
    const plain = digits.replace(/,/g, '');
    // A bare small number with no rupee sign or unit is not treated as money ("take 2 bags").
    if (!prefix && !unit && Number(plain) < 100) continue;
    const value = parseRupees(`${digits}${unit ?? ''}`);
    if (value !== null && !found.includes(value)) found.push(value);
  }
  return found;
}

/**
 * Pick the amount text for the Confirm Card.
 * - Exactly one amount in the message: use it, whatever the model said.
 * - Several: use the model's amount only if it is one of them, otherwise leave blank so the user chooses.
 * - None found: fall back to what the model copied, if the app can read it.
 */
export function chooseAmountText(message: string, modelText: string): string {
  const candidates = extractAmounts(message);
  const fromModel = parseRupees(modelText.trim());
  if (candidates.length === 1) return String(candidates[0]);
  if (candidates.length > 1) return fromModel !== null && candidates.includes(fromModel) ? String(fromModel) : '';
  if (fromModel !== null) return String(fromModel);
  return /^(₹|rs\.?|inr)?\s*0+$/i.test(modelText.trim()) ? '0' : '';
}
