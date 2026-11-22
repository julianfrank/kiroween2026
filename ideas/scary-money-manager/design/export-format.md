# Export JSON Template

The app exports one JSON file and offers this template as a separate download. Draft for Task 11: field names may change before implementation, and the file version is `1`.

## Rules
- Top-level `items` is an object. Each **key** is plain text. Each **value** is an encrypted string (base64 of `iv (12 bytes) || ciphertext+tag`). 
- Keys never contain names or amounts: `acct:<id>`, `txn:<YYYY-MM-DD>:<seq>`, `budget:<id>`, `goal:<id>`.
- Encryption: PBKDF2-SHA256 with `kdf.iterations` and `kdf.salt`, producing an AES-256-GCM key. Each value has its own random 12-byte IV.
- `meta:verifier` decrypts to the literal text `Kiroween2026`. If decryption fails, the password is wrong.
- Amounts inside decrypted values are whole **rupees** (integers, no paise). Dates are `YYYY-MM-DD` calendar dates in Indian Standard Time (IST). The app shows them as `DD/MMM/YYYY`.

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
{
  "name": "Loan - Tom",
  "kind": "liability",
  "category": null,
  "asOfDate": "2026-10-31"
}
```
`kind`: `asset | liability | equity | income | expense`. `category` is optional: `savings | investment` for assets that Goals may attach to. `system` is optional: `opening-equity | valuation-gain | valuation-loss` marks accounts the app must find later. Opening balances are not stored on the account. They are `opening` entries in the ledger (changed in Task 6).

### `txn:*`
```json
{
  "date": "2026-10-31",
  "note": "Borrowed Rs.5000 from Tom; cash received",
  "lines": [
    { "account": "acct:1a2b", "debitRupees": 5000, "creditRupees": 0 },
    { "account": "acct:7f3a", "debitRupees": 0, "creditRupees": 5000 }
  ],
  "kind": "normal",
  "reverses": null,
  "correctionOf": null,
  "source": "ai-confirmed"
}
```
- Total debits must equal total credits.
- `kind`: `opening | normal | revaluation | reversal | correction`.
- `reverses` is the key of the entry a reversal cancels. `correctionOf` links a correction to the original.
- `source`: `setup | ai-confirmed | manual-form`.`n- `intent` (optional, absent on opening entries): `income | expense | transfer | borrow | repay | revalue`. It lets the app rebuild a correction form. Reversals dated like the original so period totals cancel.

### `budget:*`
```json
{ "name": "Groceries", "monthlyLimitRupees": 10000, "accounts": ["acct:9c1d"] }
```

### `goal:*`
```json
{ "name": "Emergency fund", "targetRupees": 300000, "targetDate": "2027-12-31", "account": "acct:3b4c" }
```

## JSON Schema (decrypted file envelope)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Scary Money Manager export",
  "type": "object",
  "required": ["format", "version", "kdf", "cipher", "items"],
  "properties": {
    "format": { "const": "scary-money-manager-export" },
    "version": { "const": 1 },
    "exportedAt": { "type": "string", "format": "date-time" },
    "kdf": {
      "type": "object",
      "required": ["name", "iterations", "salt"],
      "properties": {
        "name": { "const": "PBKDF2-SHA256" },
        "iterations": { "type": "integer", "minimum": 100000 },
        "salt": { "type": "string" }
      }
    },
    "cipher": { "const": "AES-256-GCM" },
    "items": {
      "type": "object",
      "required": ["meta:verifier"],
      "propertyNames": { "pattern": "^(meta:[a-z]+|(acct|budget|goal):[a-z0-9]+|txn:\\d{4}-\\d{2}-\\d{2}:\\d{4})$" },
      "additionalProperties": { "type": "string" }
    }
  }
}
```

## Using the file from another AI tool
Another tool can create a compatible file by encrypting each value (JSON text) with the derived key. It can read a file only when it has the password. The app also validates every decrypted value against the shapes above before importing.
