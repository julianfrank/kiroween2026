# AGENTS.md: Scary Money Manager

Instructions and status for future agent sessions. Read this first, and update the **Status** section after every task.

## What this is
A single-file HTML money manager for Chrome, built for Kiroween 2026. It uses Chrome's on-device Prompt API (Gemini Nano) to turn plain text into double-entry ledger entries. Values are encrypted with a session password. The theme follows net worth. The original brief is `ideas/.ignore/PROMPTS.md`.

## Status
- **Phase:** Tasks 1 to 4 done. **Next: Task 5** (money, ledger, Rules Engine). Task 4 added: `src/crypto/crypto.ts` (PBKDF2 and AES-GCM, base64 `iv||ciphertext`), `src/crypto/attempts.ts` (wrong-password delay 1s, 2s, 4s, cap 30s), `src/store/kv.ts` (`KV` interface, `MemoryKV` for tests, `IndexedDbKV`), `src/store/vault.ts` (`createVault`, `unlockVault`, `Vault.putJson/getJson/keys`; meta keys are managed only by the vault), `src/ui/PasswordScreen.tsx`. Store metadata keys: `meta:salt`, `meta:iterations`, `meta:version`, `meta:verifier` (iterations was added to the ADR list so the KDF cost can change later). `App.tsx` shows readiness, then the password screen, then an "Unlocked" placeholder where Task 6 Setup goes. 600k PBKDF2 iterations took about 76 ms in Node. Tests use 1000 iterations for speed. The IndexedDB class is not unit tested (no fake IndexedDB in the plan), so verify it in Chrome.
- Older notes follow. Task 3 context: Scaffold: Vite 8, React 19, TypeScript, Vitest, singlefile. `src/ai/readiness.ts` is a pure state machine (injected `LanguageModel`), `src/ui/Readiness.tsx` renders it, and `src/App.tsx` holds the global AI session in a ref and destroys it on `pagehide`. The spike page was deleted. When the model is already `available`, startup runs automatically with no Start button. Task 4 adds the password screen after the `ready` state in `App.tsx`.
- **Resolved:** the Prompt API works from `file://` in Chrome (tested). No localhost fallback needed. Edge has no `LanguageModel`, so the unsupported screen must tell the user to use Chrome. `prompt()` after `destroy()` rejects with `InvalidStateError`.
- Open the built file from `dist/index.html`, never the root `index.html` (that one needs the Vite dev server).
- Commands: `npm run build` (typecheck plus single-file build), `npm test` (Vitest, includes a build check).
- Task list and progress: `ideas/scary-money-manager/plan/tasks.md`.

## Where things are
| What | Where |
|---|---|
| Domain terms (use these exact words) | `GLOSSARY.md` |
| Hard-to-reverse decisions | `docs/adr/0001` to `0004` |
| Requirements (all user decisions, Q1 to Q28) | `ideas/scary-money-manager/requirements/requirements.md` |
| Architecture, data model, AI design, dashboard | `ideas/scary-money-manager/design/design.md` |
| Export file format, template and JSON Schema | `ideas/scary-money-manager/design/export-format.md` |
| Task plan | `ideas/scary-money-manager/plan/tasks.md` |
| Research notes | `ideas/scary-money-manager/research/` |
| App source (when created) | `src/` at the repo root |

## Decisions you must not change without asking the user
- The AI only proposes. The app validates, does all arithmetic and dates, and the user confirms on a Confirm Card. Never write to the Ledger without Confirm.
- Keys are plain text and opaque. Values are encrypted (PBKDF2-SHA256 about 600k iterations plus AES-256-GCM, random IV per value). Never put names or amounts in keys.
- The Ledger is append-only. Fix mistakes with a Reversal and a Correction, each with a clear Note.
- Setup unlocks only when `Assets = Liabilities + Opening Equity` exactly, and the Imbalance is shown.
- INR only, integer paise, lakh/crore display.
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
