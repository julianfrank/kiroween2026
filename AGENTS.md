# AGENTS.md: Scary Money Manager

Instructions and status for future agent sessions. Read this first, and update the **Status** section after every task.

## What this is
A single-file HTML money manager for Chrome, built for Kiroween 2026. It uses Chrome's on-device Prompt API (Gemini Nano) to turn plain text into double-entry ledger entries. Values are encrypted with a session password. The theme follows net worth. The original brief is `ideas/.ignore/PROMPTS.md`.

## Status
- **Phase:** planning complete. Task 1 (docs) done. **Next: Task 2** (project scaffold and the `file://` spike).
- **No application code exists yet.** `src/` has not been created.
- **Open question:** whether the Prompt API runs from `file://`. Test it in Task 2. If it fails, document serving the same single file over `http://localhost` (see `docs/adr/0004-single-file-build.md`).
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
