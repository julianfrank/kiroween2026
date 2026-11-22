# Keys stay in plain text, values are encrypted, and keys are opaque IDs

Every stored item (in IndexedDB and in the Export File) has an unencrypted key and an AES-256-GCM encrypted value, as the product brief requires. Because keys are visible to anyone opening the browser, keys are opaque IDs (`acct:7f3a`, `txn:2026-10-31:0001`) and never contain names or amounts. Only fixed `meta:*` keys (`meta:verifier`, `meta:salt`, `meta:version`) are readable. The password is checked by decrypting `meta:verifier` to the known string `"Kiroween2026"`, so the password itself is never stored.

## Consequences

- Entry dates appear in plain-text keys, so the number of entries per day is visible. Accepted: names, amounts and notes are what must stay private.
- A forgotten password cannot be recovered. The UI says so.
- Changing the password re-encrypts every value in one atomic operation.
