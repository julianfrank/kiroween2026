---
inclusion: always
---

# Rules

## Decisions you must not change without asking the user
- The AI only proposes. The app validates, does all arithmetic and dates, and the user confirms on a Confirm Card. Never write to the Ledger without Confirm.
- Keys are plain text and opaque. Values are encrypted (PBKDF2-SHA256 about 600k iterations plus AES-256-GCM, random IV per value). Never put names or amounts in keys.
- The Ledger is append-only. Fix mistakes with a Reversal and a Correction, each with a clear Note.
- Setup unlocks only when `Assets = Liabilities + Opening Equity` exactly, and the Imbalance is shown.
- INR only, whole rupees (integers), no paise or decimals anywhere, lakh/crore display. Decimals are accepted only with a unit and only when the result is whole rupees (`1.2L`).
- All dates are IST (Asia/Kolkata) and displayed as DD/MMM/YYYY. Stored as ISO `YYYY-MM-DD`. "Today" is the IST date, not the machine's. Never use `toLocaleDateString` or the machine's local date.
- Revaluations are Profit or Loss (Valuation Gain as Income, Valuation Loss as Expense).
- One global AI session. Call `session.destroy()` on import, start over and tab close, and rebuild when context usage nears the limit.
- The on-device AI is required: the app does not continue past the loader without it (no "without AI" mode).
- Stack: Vite, React 19, TypeScript, d3 and d3-sankey, `vite-plugin-singlefile`. Output is one `dist/index.html`.
- Theme by Net Worth State: Twilight when net worth is within ±5% of total assets of zero (both sides), otherwise Light above 0 and Dark below 0. Switching is instant. Animations are always on, by the user's choice.
- The entry screens (loader, password, Setup) always use the dark crypt theme.
- Passwords need at least 7 characters. The session locks on tab close only (no idle timer).
- New UI uses the CSS colour variables (`var(--text)`, `var(--bad)`, `C.green` from `src/charts/palette.ts`), never fixed hex colours.

## Rules learned from real bugs
- **Never trust the model with amounts.** `src/chat/amounts.ts` reads them from the user's message; the model only picks between numbers the user wrote. A message with no number leaves the amount blank. (The model turned "30L" into 3 crore, and invented 100 crore for a sentence with no number.)
- **Account rules** (`newAccountProblem` and `looksLikeLoan` in `src/chat/draft.ts`): a new account may only be created where it grows naturally (an asset or expense that receives money, a liability or income source that gives it). Money cannot leave an account that does not exist; a repayment cannot go to a loan that does not exist. Anything named like a loan, mortgage, EMI, overdraft or credit card must be a liability.

## Working rules
- Follow the spec in `.kiro/specs/scary-money-manager/`; update `tasks.md` and the Status in `AGENTS.md` after every task.
- Add a term to `GLOSSARY.md` when a new domain concept is settled. Add an ADR only for hard-to-reverse, surprising, real trade-offs.
- Do not store the password anywhere, and never log values or the key.
- Ask the user before deleting files, changing a decision above, or adding features not in the requirements.
- The agent can drive headless Chrome through Playwright (with a fake AI), but not the real on-device model. Behaviour that depends on Gemini Nano is checked by the user with the golden-sentence AI check (Data and password > Check the AI).
