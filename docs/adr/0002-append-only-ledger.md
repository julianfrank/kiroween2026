# The Ledger is append-only, and mistakes are fixed with Reversals

Entries are never edited or deleted. A mistake is fixed by posting a Reversal and then a Correction, both linked to the original Entry and each with a clear Note. We rejected editable entries because they silently change history, which would make the trend charts, net-worth history and the Sankey unreliable.

## Consequences

- The Ledger only grows. Lists must be able to hide reversed pairs by default.
- Every Entry needs a Note, including system-made ones.
