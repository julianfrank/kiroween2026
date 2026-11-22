# AGENTS.md: Scary Money Manager

Instructions and status for future agent sessions. Read this first, and update the **Status** section after every task.

## What this is
A single-file HTML money manager for Chrome, built for Kiroween 2026. It uses Chrome's on-device Prompt API (Gemini Nano) to turn plain text into double-entry ledger entries. Values are encrypted with a session password. The theme follows net worth. The original brief is `ideas/.ignore/PROMPTS.md`.

## Status
- **Done:** Tasks 1 to 6. **Next: Task 7** (chat-to-entry pipeline). Task list: `ideas/scary-money-manager/plan/tasks.md`.
- **Commands:** `npm run build` (typecheck plus single-file build), `npm test` (Vitest, includes a build check). Open the built file `dist/index.html` in Chrome, never the root `index.html` (that one needs the Vite dev server). Edge has no Prompt API.
- **Prompt API works from `file://` in Chrome** (tested). `prompt()` after `destroy()` rejects with `InvalidStateError`.
- **App flow (`src/App.tsx`):** AI readiness, password, load data, Setup if there are no accounts, else `MainPlaceholder` (Task 8 replaces it). The global AI session is held in a ref and destroyed on `pagehide`.
- **Modules built so far:**
  - `src/ai/readiness.ts`: pure state machine with an injected `LanguageModel`.
  - `src/crypto/` (`crypto.ts`, `attempts.ts`): PBKDF2 and AES-GCM, base64 `iv||ciphertext`, wrong-password delay 1s, 2s, 4s up to 30s.
  - `src/store/`: `kv.ts` (`KV`, `MemoryKV` for tests, `IndexedDbKV`), `vault.ts` (`createVault`, `unlockVault`, `Vault.putJson/getJson/keys/clearData`; only the vault writes `meta:*` keys: `meta:salt`, `meta:iterations`, `meta:version`, `meta:verifier`), `repo.ts` (`saveSetup`, `loadAll` return `{accounts, ledger}`).
  - `src/money/money.ts`: whole rupees only (`parseRupees`, `formatRupees`). `src/dates/dates.ts`: IST `todayIso`, `formatDate` (DD/MMM/YYYY), `parseDisplayDate`.
  - `src/ledger/` (`types.ts`, `ledger.ts`): in-memory append-only `Ledger` with `append`, `reverse`, `correct`, `balance`, `netWorth`, `load`. No edit or delete.
  - `src/rules/rules.ts`: `validateEntry`, `setupImbalance`, `isSetupBalanced`.
  - `src/setup/setup.ts`: `evaluateDraft` (live gate), `buildSetup` (accounts plus dated opening entries; throws if unbalanced). System accounts carry `system: 'opening-equity' | 'valuation-gain' | 'valuation-loss'` so later code can find them. Starter categories are seeded.
  - UI: `Readiness`, `PasswordScreen`, `SetupScreen`, `MainPlaceholder` in `src/ui/`.
- **Store version is `2`.** An older store (paise, local-time dates) is refused with a message telling the user to delete the `scary-money-manager` IndexedDB in Chrome DevTools. Delete it also to redo setup while testing.
- **Not unit tested:** `IndexedDbKV` (no fake IndexedDB in the plan). Check it in Chrome.
- Tests use 1000 PBKDF2 iterations for speed. Real iterations are 600,000 (about 76 ms in Node).

## Where things are
| What | Where |
|---|---|
| Domain terms (use these exact words) | `GLOSSARY.md` |
| Hard-to-reverse decisions | `docs/adr/0001` to `0004` |
| Requirements (all user decisions, Q1 to Q28, plus later changes) | `ideas/scary-money-manager/requirements/requirements.md` |
| Architecture, data model, AI design, dashboard | `ideas/scary-money-manager/design/design.md` |
| Export file format, template and JSON Schema | `ideas/scary-money-manager/design/export-format.md` |
| Task plan | `ideas/scary-money-manager/plan/tasks.md` |
| Research notes | `ideas/scary-money-manager/research/` |
| App source | `src/` at the repo root |

## Decisions you must not change without asking the user
- The AI only proposes. The app validates, does all arithmetic and dates, and the user confirms on a Confirm Card. Never write to the Ledger without Confirm.
- Keys are plain text and opaque. Values are encrypted (PBKDF2-SHA256 about 600k iterations plus AES-256-GCM, random IV per value). Never put names or amounts in keys.
- The Ledger is append-only. Fix mistakes with a Reversal and a Correction, each with a clear Note.
- Setup unlocks only when `Assets = Liabilities + Opening Equity` exactly, and the Imbalance is shown.
- **INR only, whole rupees (integers), no paise or decimals anywhere** (changed from paise by the user after Task 6), lakh/crore display. Decimals are accepted only with a unit and only when the result is whole rupees (`1.2L`).
- **All dates are IST (Asia/Kolkata) and displayed as DD/MMM/YYYY** (added by the user after Task 6). Dates are stored as ISO `YYYY-MM-DD`. "Today" is the IST date, not the machine's. Entry dates, as-of dates and export timestamps (`+05:30`) are all IST. Never use `toLocaleDateString` or the machine's local date.
- Revaluations are Profit or Loss (Valuation Gain as Income, Valuation Loss as Expense).
- One global AI session. Call `session.destroy()` on import and tab close, and rebuild when context usage nears the limit.
- Stack: Vite, React 19 (latest), TypeScript, d3 and d3-sankey, `vite-plugin-singlefile`. Output is one `dist/index.html`.
- Theme by Net Worth State (Light above 0, Twilight within ±5% of total assets of zero, Dark below 0). Switching is instant. Animations are always on, by the user's choice.
- Session locks on tab close only (no idle timer).

## Working rules
- Follow `plan/tasks.md` in order. Each task has a demo and tests. Do not add tests beyond those named there unless asked.
- Keep planning and design documents under `ideas/scary-money-manager/`. Only `AGENTS.md`, `GLOSSARY.md` and `docs/adr/` live at the repo root.
- Add a term to `GLOSSARY.md` when a new domain concept is settled. Add an ADR only for hard-to-reverse, surprising, real trade-offs.
- Do not store the password anywhere, and never log values or the key.
- Ask the user before deleting files, changing a decision above, or adding features not in the requirements.
- Windows with PowerShell: use `;` to chain commands. Do not start long-running dev servers from the agent shell. Ask the user to run them.
- I cannot drive a browser in the agent session. The user checks each browser demo in Chrome.
