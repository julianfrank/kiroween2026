# The AI proposes, the app validates, the user confirms

The on-device model (Gemini Nano) only turns text into a schema-constrained Proposed Entry. The app code does all arithmetic, date resolution and balance checking, and nothing is written until the user presses Confirm on the Confirm Card. We rejected auto-commit (with undo) and model-driven writes because a small model misreads amounts and dates, and wrong money data is costly to notice later.

## Consequences

- One extra click per Entry.
- On invalid output the app retries once, then asks a clarifying question and offers a pre-filled manual form.
