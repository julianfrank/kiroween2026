// The Export JSON Template the user can download for other AI tools. Keep in step with
// ideas/scary-money-manager/design/export-format.md (a test checks the example against the importer).

import { EXPORT_FORMAT, EXPORT_VERSION, ITEM_KEY, MAX_ITERATIONS, MIN_ITERATIONS } from './format';

const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Calendar date in IST (Asia/Kolkata), YYYY-MM-DD.' };
const rupees = { type: 'integer', minimum: 0, description: 'Whole rupees. No paise or decimals.' };

/** Example decrypted values: a tiny, balanced set of books. */
export const EXAMPLE_VALUES: Record<string, unknown> = {
  'acct:0e01': { name: 'Opening Equity', kind: 'equity', asOfDate: '2026-11-01', system: 'opening-equity' },
  'acct:0e02': { name: 'Valuation Gain', kind: 'income', asOfDate: '2026-11-01', system: 'valuation-gain' },
  'acct:0e03': { name: 'Valuation Loss', kind: 'expense', asOfDate: '2026-11-01', system: 'valuation-loss' },
  'acct:1a2b': { name: 'Cash', kind: 'asset', category: null, asOfDate: '2026-11-01' },
  'acct:3b4c': { name: 'Savings', kind: 'asset', category: 'savings', asOfDate: '2026-11-01' },
  'acct:7f3a': { name: 'Loan - Tom', kind: 'liability', category: null, asOfDate: '2026-11-02' },
  'acct:9c1d': { name: 'Food', kind: 'expense', asOfDate: '2026-11-01' },
  'txn:2026-11-01:0001': {
    date: '2026-11-01',
    note: 'Opening balance: Cash, as of 01/Nov/2026',
    lines: [
      { account: 'acct:1a2b', debitRupees: 20000, creditRupees: 0 },
      { account: 'acct:0e01', debitRupees: 0, creditRupees: 20000 },
    ],
    kind: 'opening',
    reverses: null,
    correctionOf: null,
    source: 'setup',
  },
  'txn:2026-11-02:0001': {
    date: '2026-11-02',
    note: 'Borrowed ₹5,000 (Loan - Tom); received into Cash. You said: "I\'ve taken a loan of Rs.5000 from Tom"',
    lines: [
      { account: 'acct:1a2b', debitRupees: 5000, creditRupees: 0 },
      { account: 'acct:7f3a', debitRupees: 0, creditRupees: 5000 },
    ],
    kind: 'normal',
    reverses: null,
    correctionOf: null,
    source: 'ai-confirmed',
    intent: 'borrow',
  },
  'txn:2026-11-03:0001': {
    date: '2026-11-03',
    note: 'Paid ₹800 for Food from Cash',
    lines: [
      { account: 'acct:9c1d', debitRupees: 800, creditRupees: 0 },
      { account: 'acct:1a2b', debitRupees: 0, creditRupees: 800 },
    ],
    kind: 'normal',
    reverses: null,
    correctionOf: null,
    source: 'manual-form',
    intent: 'expense',
  },
  'budget:5d6e': { name: 'Food', monthlyLimitRupees: 8000, accounts: ['acct:9c1d'] },
  'goal:8f9a': { name: 'Emergency fund', targetRupees: 300000, targetDate: '2027-12-31', account: 'acct:3b4c' },
};

export function buildTemplate() {
  return {
    title: 'Scary Money Manager: Export JSON Template',
    description:
      'How the app stores and exports data, so other tools can read or write compatible files. The file is one JSON envelope. Every item key is plain text; every item value is encrypted.',
    rules: [
      'Keys are opaque IDs and never contain names or amounts: acct:<id>, txn:<YYYY-MM-DD>:<4-digit sequence>, budget:<id>, goal:<id>. IDs use a-z and 0-9.',
      'Each value is the JSON text of one item, encrypted with AES-256-GCM. Store base64(iv || ciphertext-with-tag) with a fresh random 12-byte IV per value.',
      `The AES key is PBKDF2-SHA256(password, salt, iterations) with a 16-byte random salt and ${MIN_ITERATIONS} to ${MAX_ITERATIONS} iterations (the app uses 600000).`,
      'items["meta:verifier"] is the encrypted text "Kiroween2026". If it does not decrypt, the password is wrong.',
      'Amounts are whole rupees (integers). Dates are YYYY-MM-DD calendar dates in Indian Standard Time; the app shows them as DD/MMM/YYYY.',
      'Every entry must balance: total debitRupees equals total creditRupees, and each line has exactly one of the two above zero.',
      'Money moves from the credited account to the debited account. Assets and expenses grow with debits; liabilities, equity and income grow with credits.',
      'A file with any accounts needs exactly one account each marked system "opening-equity" (equity), "valuation-gain" (income) and "valuation-loss" (expense).',
      'The ledger is append-only. A mistake is fixed with a reversal (kind "reversal", reverses = the original key, same date) and a correction (kind "correction", correctionOf = the original key).',
      'Importing a file replaces everything in the browser. The app checks the password and every item first, and changes nothing if anything is wrong.',
    ],
    envelopeSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Scary Money Manager export envelope',
      type: 'object',
      required: ['format', 'version', 'exportedAt', 'kdf', 'cipher', 'items'],
      properties: {
        format: { const: EXPORT_FORMAT },
        version: { const: EXPORT_VERSION },
        exportedAt: { type: 'string', description: 'IST timestamp, for example 2026-11-22T15:30:00+05:30.' },
        kdf: {
          type: 'object',
          required: ['name', 'iterations', 'salt'],
          properties: {
            name: { const: 'PBKDF2-SHA256' },
            iterations: { type: 'integer', minimum: MIN_ITERATIONS, maximum: MAX_ITERATIONS },
            salt: { type: 'string', description: '16 random bytes, base64.' },
          },
        },
        cipher: { const: 'AES-256-GCM' },
        items: {
          type: 'object',
          required: ['meta:verifier'],
          propertyNames: { pattern: ITEM_KEY.source },
          additionalProperties: { type: 'string', description: 'base64(iv || ciphertext-with-tag)' },
        },
      },
    },
    valueSchemas: {
      'acct:*': {
        type: 'object',
        required: ['name', 'kind', 'asOfDate'],
        properties: {
          name: { type: 'string', minLength: 1, description: 'Unique, ignoring case and punctuation.' },
          kind: { enum: ['asset', 'liability', 'equity', 'income', 'expense'] },
          category: { enum: ['savings', 'investment', null], description: 'Assets only. Goals attach to these.' },
          asOfDate: date,
          system: { enum: ['opening-equity', 'valuation-gain', 'valuation-loss'], description: 'Accounts the app itself needs.' },
        },
      },
      'txn:*': {
        type: 'object',
        required: ['date', 'note', 'lines', 'kind', 'reverses', 'correctionOf', 'source'],
        properties: {
          date: { ...date, description: 'Must match the date in the key.' },
          note: { type: 'string', description: 'What the entry is about and why it exists.' },
          lines: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['account', 'debitRupees', 'creditRupees'],
              properties: { account: { type: 'string', description: 'An acct: key in the same file.' }, debitRupees: rupees, creditRupees: rupees },
            },
          },
          kind: { enum: ['opening', 'normal', 'revaluation', 'reversal', 'correction'] },
          reverses: { type: ['string', 'null'] },
          correctionOf: { type: ['string', 'null'] },
          source: { enum: ['setup', 'ai-confirmed', 'manual-form'] },
          intent: { enum: ['income', 'expense', 'transfer', 'borrow', 'repay', 'revalue'], description: 'Optional. Lets the app rebuild a correction form.' },
        },
      },
      'budget:*': {
        type: 'object',
        required: ['name', 'monthlyLimitRupees', 'accounts'],
        properties: {
          name: { type: 'string' },
          monthlyLimitRupees: { ...rupees, minimum: 1, description: 'Limit per calendar month; unused money does not carry over.' },
          accounts: { type: 'array', minItems: 1, items: { type: 'string', description: 'Expense acct: keys.' } },
        },
      },
      'goal:*': {
        type: 'object',
        required: ['name', 'targetRupees', 'targetDate', 'account'],
        properties: {
          name: { type: 'string' },
          targetRupees: { ...rupees, minimum: 1 },
          targetDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          account: { type: 'string', description: 'A savings or investment asset acct: key. Progress is that account\'s balance.' },
        },
      },
    },
    exampleEnvelope: {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: '2026-11-22T15:30:00+05:30',
      kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: '<16 random bytes, base64>' },
      cipher: 'AES-256-GCM',
      items: Object.fromEntries([['meta:verifier', '<encrypted "Kiroween2026">'], ...Object.keys(EXAMPLE_VALUES).map((k) => [k, '<encrypted JSON of the value below>'])]),
    },
    exampleDecryptedValues: EXAMPLE_VALUES,
    encryptOneValue: [
      'key = PBKDF2(SHA-256, password, base64decode(kdf.salt), kdf.iterations) -> 256-bit AES-GCM key',
      'iv = 12 random bytes',
      'ct = AES-GCM-encrypt(key, iv, UTF-8 bytes of JSON.stringify(value))   // includes the 16-byte tag',
      'items[key] = base64(iv || ct)',
    ],
  };
}

export const TEMPLATE_FILE_NAME = 'scary-money-manager-export-template.json';
