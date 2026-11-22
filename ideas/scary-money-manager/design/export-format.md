# Export JSON Template

The app exports one JSON file and offers this template as a separate download. Draft for Task 11: field names may change before implementation, and the file version is `1`.

## Rules
- Top-level `items` is an object. Each **key** is plain text. Each **value** is an encrypted string (base64 of `iv (12 bytes) || ciphertext+tag`). 
- Keys never contain names or amounts: `acct:<id>`, `txn:<YYYY-MM-DD>:<seq>`, `budget:<id>`, `goal:<id>`.
- Encryption: PBKDF2-SHA256 with `kdf.iterations` and `kdf.salt`, producing an AES-256-GCM key. Each value has its own random 12-byte IV.
- `meta:verifier` decrypts to the literal text `Kiroween2026`. If decryption fails, the password is wrong.
- Amounts inside decrypted values are integer **paise** (₹1 = 100). Dates are `YYYY-MM-DD`.

## Envelope
```json
{
  "format": "scary-money-manager-export",
  "version": 1,
  "exportedAt": "2026-11-22T10:00:00Z",
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
  "asOfDate": "2026-10-31",
  "openingPaise": 0,
  "createdAt": "2026-10-31T09:00:00Z"
}
```
`kind`: `asset | liability | equity | income | expense`. `category` is optional: `savings | investment` for assets that Goals may attach to.

### `txn:*`
```json
{
  "date": "2026-10-31",
  "note": "Borrowed Rs.5000 from Tom; cash received",
  "lines": [
    { "account": "acct:1a2b", "debitPaise": 500000, "creditPaise": 0 },
    { "account": "acct:7f3a", "debitPaise": 0, "creditPaise": 500000 }
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
- `source`: `setup | ai-confirmed | manual-form`.

### `budget:*`
```json
{ "name": "Groceries", "monthlyLimitPaise": 1000000, "accounts": ["acct:9c1d"] }
```

### `goal:*`
```json
{ "name": "Emergency fund", "targetPaise": 30000000, "targetDate": "2027-12-31", "account": "acct:3b4c" }
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
