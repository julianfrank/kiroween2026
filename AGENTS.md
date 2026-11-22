# AGENTS.md: Scary Money Manager

Instructions and status for future agent sessions. Read this first, and update the **Status** section after every task.

## What this is
A single-file HTML money manager for Chrome, built for Kiroween 2026. It uses Chrome's on-device Prompt API (Gemini Nano) to turn plain text into double-entry ledger entries. Values are encrypted with a session password. The theme follows net worth. The original brief is `ideas/.ignore/PROMPTS.md`.

## Status
- **All 12 planned tasks are built.** Task list and per-task notes: `ideas/scary-money-manager/plan/tasks.md`.
- **Still open (needs the user, in Chrome with the real model):** the golden-sentence accuracy run. Open the app, then "Data and password" > "Check the AI" > "Run the AI check", and paste the report back. No accuracy figure has been recorded yet. Record it in `research/prompt-api.md` and fix the prompt or the app for repeated failures.
- **Checks:** `npm run build` (typecheck and single-file build, about 384 KB), `npm test` (Vitest, 160 tests including a build check), `npm run test:e2e` (build, then Playwright in the installed Google Chrome, headless, opening `dist/index.html` from disk with a fake Prompt API and a New York time zone; 2 tests). All pass.
- Open the built file `dist/index.html` in Chrome, never the root `index.html` (that one needs the Vite dev server). The Prompt API works from `file://` in Chrome (tested). Edge has no Prompt API. `prompt()` after `destroy()` rejects with `InvalidStateError`.
- **Store version is `2`.** An older store (paise, local-time dates) is refused with a message telling the user to delete the `scary-money-manager` IndexedDB in Chrome DevTools. Delete it also to redo setup while testing.
- **Known data issue on the user's test machine:** some early entries booked a home loan as an asset (the -100 crore bug). The engine now refuses this, but old entries stay until the user reverses them or resets the database.

## How the code is organised (`src/`)
- **Startup (`App.tsx`):** AI readiness (`ai/readiness.ts`, `ui/Readiness.tsx`), then password (`ui/PasswordScreen.tsx`, which also offers "Or start from an export file"), then load data, then Setup if there are no accounts (`setup/setup.ts`, `ui/SetupScreen.tsx`), else `ui/AppShell.tsx`. `App` owns the one `AiHost` (`ai/host.ts`) and destroys it on `pagehide`.
- **AI (`ai/host.ts`):** one global session. Rebuilt when the context is 80% full (`contextUsage/contextWindow`, or the older `inputUsage/inputQuota`), and once more on `QuotaExceededError`. `renew()` after import, `destroy()` on tab close and import.
- **Crypto and storage:** `crypto/crypto.ts` (PBKDF2-SHA256 600k, AES-256-GCM, base64 `iv||ciphertext`), `crypto/attempts.ts` (wrong-password delay 1s, 2s, 4s up to 30s), `store/kv.ts` (`KV` with an atomic `replaceAll`; `MemoryKV` for tests, `IndexedDbKV`), `store/vault.ts` (`createVault`, `unlockVault`, `changePassword`, `readMeta`; only the vault writes `meta:salt`, `meta:iterations`, `meta:version`, `meta:verifier`), `store/repo.ts` (`loadAll`, `saveSetup`, `commitEntry`, `commitTarget`, `commitReversal`, `commitCorrection`, `commitRename`; `LoadedData` is `{accounts, ledger, budgets, goals}`).
- **Money and dates:** `money/money.ts` (whole rupees only: `parseRupees`, `formatRupees`, `formatCompact`), `dates/dates.ts` (IST `todayIso`, `istTimestamp`, `formatDate` DD/MMM/YYYY, `parseDisplayDate`, `monthRange`), `dates/resolve.ts` (date phrases).
- **Ledger and rules:** `ledger/ledger.ts` (append-only: `append`, `preview`, `planReversal`, `reverse`, `correct`, `balance`, `movement`, `netWorth`, `load`; no edit or delete), `rules/rules.ts` (`validateEntry`, setup balance).
- **Chat pipeline (`chat/`):** `intents.ts` (income, expense, transfer, borrow, repay, revalue, set-budget, set-goal; `TAB_SCOPES`; money flows from the credited account to the debited one), `proposal.ts` (`proposeEntry`: JSON-schema prompt, one retry on bad JSON or a wrong kind of account, then a pre-filled form; outcomes confirm, needs-input, redirect, error), `draft.ts` (`resolveAny` turns the editable draft into a balanced entry, a budget or a goal; account rules below), `amounts.ts` (amounts come only from the user's message).
- **Targets:** `targets/` (`Budget`, `Goal`, `budgetProgress`, `goalProgress`; progress always comes from the ledger).
- **Charts:** `charts/data.ts` (pure builders; `flows` skips opening entries; Sankeys are sources, a "Money in" hub, then targets, so no cycles; revaluations are their own purple kind), `Sankey.tsx`, `LineChart.tsx`, `Bars.tsx`, `palette.ts` (CSS-variable colours), `ui/Dashboard.tsx` (two Sankeys, date range, seven chart tabs).
- **Theme:** `theme/theme.ts` (`netWorthState`, `useTheme`), `theme.css` (all colours are CSS variables per `data-theme`), `Decor.tsx`, `events.ts`, `EntryAnimation.tsx`, `ui/AnimatedNumber.tsx`.
- **Export and import:** `export/format.ts` (`exportWithCurrentPassword`, `exportWithNewPassword`, `parseEnvelope`, `openExport`, `importExportFile`), `validate.ts` (`validateItems`, `ImportError`), `template.ts` (the downloadable Export Template), `download.ts`, `ui/DataPanel.tsx` (the "Data and password" panel: export, template, import, change password, AI check). On import the AI session is destroyed before the store is replaced, chat transcripts are dropped (the `AppShell` key changes), and a fresh session starts. The file's password becomes the session password.
- **Golden sentences:** `golden/golden.ts` (36 cases against made-up accounts, `runGolden`, `formatReport`), `ui/GoldenCheck.tsx`.
- **Tests:** next to the code (`*.test.ts(x)`). React tests start with `// @vitest-environment jsdom`; jsdom has `crypto.subtle`, so they can use a real `MemoryKV` vault. Tests use 1000 or 100,000 PBKDF2 iterations for speed. End-to-end tests are in `e2e/`.

## Rules learned from real bugs
- **Never trust the model with amounts.** `chat/amounts.ts` reads them from the user's message; the model only picks between numbers the user wrote. A message with no number leaves the amount blank. (The model turned "30L" into 3 crore, and invented 100 crore for a sentence with no number.)
- **Account rules** (`newAccountProblem` and `looksLikeLoan` in `chat/draft.ts`): a new account may only be created where it grows naturally (an asset or expense that receives money, a liability or income source that gives it). Money cannot leave an account that does not exist, and a repayment cannot go to a loan that does not exist. Anything named like a loan, mortgage, EMI, overdraft or credit card must be a liability. These are `account-kind` problems, which get one model retry before any tab redirect.
- Payments that would leave an asset below zero show a warning on the Confirm Card. The Daily Updates list shows each entry's Dr and Cr lines.

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
| App source / end-to-end tests | `src/`, `e2e/` at the repo root |

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
- Theme by Net Worth State: Twilight when net worth is within ±5% of total assets of zero (both sides), otherwise Light above 0 and Dark below 0. Switching is instant. Animations are always on, by the user's choice.
- Session locks on tab close only (no idle timer).
- New UI must use the CSS colour variables (`var(--text)`, `var(--bad)`, `C.green` from `src/charts/palette.ts`), never fixed hex colours.

## Working rules
- Keep planning and design documents under `ideas/scary-money-manager/`. Only `AGENTS.md`, `GLOSSARY.md` and `docs/adr/` live at the repo root.
- Add a term to `GLOSSARY.md` when a new domain concept is settled. Add an ADR only for hard-to-reverse, surprising, real trade-offs.
- Do not store the password anywhere, and never log values or the key.
- Ask the user before deleting files, changing a decision above, or adding features not in the requirements.
- Run `npm run build`, `npm test` and `npm run test:e2e` before calling a change done.
- Windows with PowerShell: use `;` to chain commands. Do not start long-running dev servers from the agent shell. Ask the user to run them.
- The agent can drive headless Chrome through Playwright (with a fake AI), but not the real on-device model. Behaviour that depends on Gemini Nano is checked by the user with the golden-sentence AI check.
