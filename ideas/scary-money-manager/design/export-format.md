# Export JSON Template

The app exports one JSON file (the Export File) and offers the Export Template as a separate download ("Data and password" > "Download the export template"). The template is built by `src/export/template.ts`, and a test checks that its example passes the importer. Envelope version is `1`.

## Rules
- Top-level `items` is an object. Each **key** is plain text. Each **value** is an encrypted string: base64 of `iv (12 bytes) || ciphertext-with-tag`.
- Keys never contain names or amounts. Allowed keys match `^(meta:verifier|(acct|budget|goal):[a-z0-9]+|txn:\d{4}-\d{2}-\d{2}:\d{4})$`.
- Encryption: PBKDF2-SHA256 with `kdf.iterations` (100,000 to 10,000,000; the app uses 600,000) and a 16-byte `kdf.salt`, producing an AES-256-GCM key. Each value has its own random 12-byte IV.
- `items["meta:verifier"]` decrypts to the literal text `Kiroween2026`. If decryption fails, the password is wrong.
- Amounts inside decrypted values are whole **rupees** (integers, no paise). Dates are `YYYY-MM-DD` calendar dates in Indian Standard Time (IST). The app shows them as `DD/MMM/YYYY`. `exportedAt` is an IST timestamp ending in `+05:30`.
- A file with any accounts must have exactly one account each with `system` set to `opening-equity` (equity), `valuation-gain` (income) and `valuation-loss` (expense).

## Envelope
```json
{
  "format": "scary-money-manager-export",
  "version": 1,
  "exportedAt": "2026-11-22T15:30:00+05:30",
  "kdf": { "name": "PBKDF2-SHA256", "iterations": 600000, "salt": "<base64, 16 bytes>" },
  "cipher": "AES-256-GCM",
  "items": {
    "meta:verifier": "<encrypted>",
    "acct:7f3a": "<encrypted>",
    "txn:2026-10-31:0001": "<encrypted>"
  }
}
```

## Decrypted value shapes

### `acct:*`
```json
{ "name": "Loan - Tom", "kind": "liability", "category": null, "asOfDate": "2026-10-31" }
```
- `kind`: `asset | liability | equity | income | expense`.
- `category` (optional, assets only): `savings | investment | null`. Goals attach to these.
- `system` (optional): `opening-equity | valuation-gain | valuation-loss` marks accounts the app itself needs.
- Names must be unique, ignoring case and punctuation.
- Opening balances are not stored on the account. They are `opening` entries in the ledger.

### `txn:*`
```json
{
  "date": "2026-10-31",
  "note": "Borrowed ₹5,000 (Loan - Tom); received into Cash",
  "lines": [
    { "account": "acct:1a2b", "debitRupees": 5000, "creditRupees": 0 },
    { "account": "acct:7f3a", "debitRupees": 0, "creditRupees": 5000 }
  ],
  "kind": "normal",
  "reverses": null,
  "correctionOf": null,
  "source": "ai-confirmed",
  "intent": "borrow"
}
```
- The date in the key must match `date`.
- Total debits must equal total credits, and each line has exactly one of the two above zero. Money moves from the credited account to the debited account.
- `kind`: `opening | normal | revaluation | reversal | correction`.
- `reverses` is the key of the entry a reversal cancels (reversals are dated like the original so period totals cancel). An entry can be reversed once, and a reversal cannot be reversed. `correctionOf` links a correction to the original.
- `source`: `setup | ai-confirmed | manual-form`.
- `intent` (optional, absent on opening entries): `income | expense | transfer | borrow | repay | revalue`. It lets the app rebuild a correction form.

### `budget:*`
```json
{ "name": "Food", "monthlyLimitRupees": 8000, "accounts": ["acct:9c1d"] }
```
Every account must be an expense account in the file.

### `goal:*`
```json
{ "name": "Emergency fund", "targetRupees": 300000, "targetDate": "2027-12-31", "account": "acct:3b4c" }
```
The account must be a savings or investment asset in the file. `targetDate` may be `null`.

## Export and import behaviour
- **Export with the current password** copies the stored ciphertext and the store's salt and verifier. Nothing is decrypted.
- **Export with a different password** decrypts every value and encrypts it again under a new salt and key. The browser keeps its own password.
- **Import** reads the file, checks the envelope, checks the password against `meta:verifier`, decrypts and checks every item (shapes, links between items, the balance of every entry, the whole ledger's balance). Only then does it destroy the AI session, clear chat, and replace the whole browser store in one IndexedDB transaction with the file's items and meta. The file's password becomes the session password. Any failure before that changes nothing.
- **Password change** checks the current password, re-encrypts every value under a new salt, and replaces the store in one transaction.

## Using the file from another AI tool
Download the Export Template. It contains the rules, a JSON Schema for the envelope and for each value type, an annotated example with decrypted values, and the steps to encrypt one value. Another tool can read a file only when it has the password, and the app checks every value before importing.
