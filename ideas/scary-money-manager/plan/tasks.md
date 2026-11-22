# Task Plan: Scary Money Manager

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done. Update this file and the root `AGENTS.md` after each task.

- [x] **Task 1: Research and documentation baseline.** Research notes, GLOSSARY, ADRs, requirements, design, export format, this plan, root AGENTS.md. *Demo:* the docs read end to end.
- [x] **Task 2: Scaffold and `file://` spike.** *Spike result: the Prompt API works from `file://` in Chrome, so the localhost fallback is not needed. Edge has no `LanguageModel`.* Vite, React 19, TypeScript, Vitest, `vite-plugin-singlefile`. A page calls `LanguageModel.availability()` and `create()`. Record the `file://` result in `research/prompt-api.md` and `AGENTS.md`. *Test:* build outputs one `dist/index.html`. *Demo:* open it and see the AI status.
- [x] **Task 3: AI readiness screen.** *Done: `src/ai/readiness.ts` (state machine), `src/ui/Readiness.tsx`, `src/App.tsx`. 7 tests with a fake `LanguageModel`. Browser demo pending the user's check.* States: checking, needs download (Start button), downloading with percent, initializing, testing, ready, unsupported. *Test:* fake `LanguageModel` per state. *Demo:* progress ends at "Ready to Work".
- [x] **Task 4: Crypto and encrypted store.** *Done: `src/crypto/`, `src/store/` (`kv.ts`, `vault.ts`), `src/ui/PasswordScreen.tsx`. 9 tests. Browser demo pending the user's check.* PBKDF2 and AES-GCM, verifier, IndexedDB wrapper, opaque IDs, wrong-password delay. *Test:* round trip, wrong password rejected, no plaintext in storage. *Demo:* password screen creates a store.
- [x] **Task 5: Money, ledger and Rules Engine.** *Done: `src/money/money.ts`, `src/ledger/{types,ledger}.ts`, `src/rules/rules.ts`, 14 tests. The "test page" demo is covered by the tests instead.* Paise, lakh/crore formatting, dated double-entry Entries, Reversals, validators. *Test:* entries stay balanced, a reversal links to its original. *Demo:* test page posting and reversing Entries.
- [ ] **Task 6: Setup gate.** Opening Assets, Liabilities, Opening Equity with As-of Dates, visible Imbalance, "use difference", starter categories. *Test:* unlocks only at zero. *Demo:* setup with a backdated house.
- [ ] **Task 7: Chat-to-entry pipeline.** Tab Scopes, schema-constrained proposal, date resolver, Confirm Card with new Accounts, retry once, manual form, tab redirect. *Test:* mocked AI (valid, invalid JSON, ambiguous). *Demo:* "I've taken a Loan of Rs.5000 from Tom" creates a confirmed, balanced Entry.
- [ ] **Task 8: The six tabs.** Dashboard shell, Assets (with Revaluation), Liabilities, Goals, Budgets, Daily Updates. *Test:* React tests per tab. *Demo:* all tabs work end to end.
- [ ] **Task 9: Dashboard charts.** Two Sankeys with a date range, seven sub-tabs. *Test:* data builders against fixture ledgers. *Demo:* charts update after each confirmed Entry.
- [ ] **Task 10: Net-worth theme and animations.** Light, Twilight, Dark. Instant switching, per-Entry animations. *Test:* Net Worth State mapping. *Demo:* crossing zero changes the theme.
- [ ] **Task 11: Export, import, password change.** Encrypted export (optionally with a new password), template download, replace-on-import that destroys the AI session. *Test:* round trip, wrong password changes nothing, `prompt()` rejects after destroy. *Demo:* export and import in a clean profile.
- [ ] **Task 12: Hardening and acceptance.** Golden-sentence accuracy run, Playwright smoke test, context rebuild check, final AGENTS.md update. *Demo:* the single `index.html` runs the full flow.

## Order and dependencies
2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Tasks 9 and 10 can be swapped. Task 2's result may change how the file is opened (see `docs/adr/0004-single-file-build.md`).
