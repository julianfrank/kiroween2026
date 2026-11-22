# Requirements: Scary Money Manager

Source brief: `ideas/.ignore/PROMPTS.md`. Terms are defined in the root `GLOSSARY.md`. Every decision below was confirmed by the user in the grilling session (Q numbers in brackets).

## 1. Product summary
A single HTML file for Chrome. It uses Chrome's built-in Prompt API (Gemini Nano) to turn plain text into Ledger Entries. Money data is encrypted with a session password. The theme follows Net Worth.

## 2. Boot sequence
1. **AI readiness screen.** Shows each step on screen: Checking, Needs download (a Start button, because the download needs a user click), Downloading model with a percent, Initializing model, Testing model, Ready to Work. The app proceeds only when the model answers a test prompt. If the device cannot run the model (Chrome needs about 22 GB free disk, and a GPU with more than 4 GB VRAM or 16 GB RAM with 4 cores), show an "unsupported device" screen with the reason. [Q14]
2. **Password screen.** The user enters the Session password. The app derives a key and checks it against the stored verifier (`"Kiroween2026"`). A wrong password is refused with an increasing delay between attempts. The screen warns that a forgotten password cannot be recovered. [Q3, Q4, Q17]
3. **Data check.** If the browser has no database, go to Setup. Otherwise go to the Main App.

## 3. Setup (first run)
- The user creates Accounts with opening balances for Assets and Liabilities, and an Opening Equity line. Starter categories are seeded: Income (Salary, Other), Expense (Food, Rent, Transport, Utilities, Other), Savings, Investments. [Q12]
- Each opening balance has an As-of Date and may be backdated (for example, a house bought for ₹40L in 2000). Opening Entries are dated and carry a Note such as "Opening balance: House, acquired 2000". Historical charts start from each Account's As-of Date. [Q23, Q24]
- The Imbalance (`Assets − (Liabilities + Opening Equity)`) is shown clearly on screen at all times. A "use difference" button fills Opening Equity. The Main App unlocks only at exactly zero. [Q1]

## 4. Security and data
- Keys stay in plain text and values are encrypted, in both IndexedDB and the Export File. Keys are opaque IDs. Fixed readable keys: `meta:verifier`, `meta:salt`, `meta:version`. [Q3]
- PBKDF2-SHA256 (about 600,000 iterations) and AES-256-GCM with a random IV per value. [Q4]
- The Session ends only when the tab closes (no idle timer). The user can change the password during a Session, or export with a different password. [Q17]
- Money is INR only, in **whole rupees** (integers, no paise or decimals anywhere), shown with lakh/crore grouping (₹1,20,000). Typed amounts such as `5000.50` are rejected. [Q10, revised in Task 6 feedback]

## 5. AI behaviour
- One global AI session. It is destroyed with `session.destroy()` on tab close and on import, and recreated with a fresh system prompt when `contextUsage` nears `contextWindow`. After destroy, `prompt()` must reject. [Q9, Q13]
- The AI only returns a schema-constrained Proposed Entry. The app does the arithmetic, resolves dates, runs the Rules Engine and shows a Confirm Card. Nothing is written without Confirm. [Q2]
- The AI may propose a new Account (for example "Loan–Tom") on the Confirm Card. The user can rename it before confirming. [Q12]
- The model returns a date phrase ("yesterday", "2026-10-28"). A deterministic resolver in app code converts it. The Confirm Card shows the resolved date, which is editable. The default is today, and future dates are flagged. [Q23]
- On invalid output the app retries once with the error text. If that also fails it asks a clarifying question and offers a manual form pre-filled with what was understood. [Q26]
- Each tab's chat has a Tab Scope. An out-of-scope message shows "That looks like a <Tab> entry. Switch there?" with a button that moves the message. [Q18]

## 6. Ledger rules
- The Ledger is append-only. A mistake is fixed with a Reversal plus a Correction, both linked to the original. Every Entry has a clear Note. [Q11]
- Revaluation of an Asset is booked as Valuation Gain (Income) or Valuation Loss (Expense), and charts label these flows so they can be told apart from salary and spending. [Q22]
- Budgets are monthly per calendar month, with no carry-over. Goals attach to Savings or Investment Accounts. Progress is computed from the Ledger. [Q5, Q25]

## 7. Main App tabs
Dashboard (Home), Assets, Liabilities, Goals, Budgets, Daily Updates (Ledger). Each has a list of its items and a chat. [Brief, Q18]

### Dashboard
- Home shows the Actual Sankey and Planned Sankey side by side, with a date range picker (default: current month). [Q15, Q16b]
- Seven sub-tabs: Income vs Expense vs Budget trend; Income vs Savings/Investments vs Goals trend; Net worth over time; Expense breakdown; Budget utilisation; Goal progress with projected completion; Liabilities summary. [Q16]
- Charts update in real time after each confirmed Entry.

## 8. Theme and animation
- Net Worth State drives the theme: Light (> 0) is a clean Office-style look with light Halloween touches. Twilight is within ±5% of total Assets of zero. Dark (< 0) is a dark Halloween look. [Q19, Q20]
- The theme switches instantly, with no hysteresis and no transition. [Q20]
- Animations are always on and do not follow `prefers-reduced-motion` (the user's explicit choice). They highlight the financial situation and illustrate each Entry (for example money moving between Accounts). [Q19, Q20]

## 9. Export and import
- Export is a single JSON file with plain-text keys and encrypted values, optionally encrypted with a new password. [Q17]
- The app offers a separate download of the **Export JSON Template** (JSON Schema, annotated example, field notes) so other AI tools can read or produce compatible files. See `design/export-format.md`. [Q17]
- Import replaces everything after an explicit warning. A wrong password changes nothing. On import the AI session is destroyed with `session.destroy()`, chat state is cleared, and the balance check runs again. [Q13]

## 10. Testing
Vitest unit tests (crypto, ledger, rules, dates, chart builders, theme mapping, import/export), React Testing Library with a fake `LanguageModel`, a golden set of 30 to 50 sentences run manually against the real model with an accuracy score, and a Playwright smoke test of the built file with the AI mocked. [Q21]

## 11. Out of scope
Multi-currency, live exchange rates, weekly/quarterly budgets, budget carry-over, multiple profiles, merge-on-import, idle auto-lock, `prefers-reduced-motion` handling, and editing or deleting Entries.

## 12. Dates and time zone (added in Task 6 feedback)
- Every date shown on screen is DD/MMM/YYYY (for example 22/Nov/2026).
- All dates are Indian Standard Time (Asia/Kolkata). "Today" is the IST date, whatever the computer's time zone is. Entry dates, as-of dates and export timestamps are IST (timestamps carry +05:30).
- Dates are stored as ISO YYYY-MM-DD and formatted only for display. Typed dates are accepted as DD/MMM/YYYY, DD/MM/YYYY or ISO.

## 13. Start over and the Data tab (added after Task 12)
- "Data and password" is the last main tab (after Daily Updates). It holds export, the Export Template, import, password change, the AI check and Start over.
- **Start over** deletes everything in the browser (accounts, entries, budgets, goals and the password check) after the user types `DELETE`. The AI session is destroyed first. The app returns to "Choose a password" and then Setup.
- The password screen has one password field (more than six characters, so at least 7). Once it is long enough it offers **Unlock** (when a database exists), **Upload new file** (an export encrypted with this password; replaces the database after a warning) and **Start New Database** (asks for the password again, warns, deletes any existing database, then starts Setup). The 7-character minimum also applies to a password change and to an export file password. Wrong passwords on Unlock and Upload wait 1s, 2s, 4s and so on.

## 14. Header and title (added after Task 12)
- A fixed floating header on every screen shows the title, the build version from package.json, "by Julian Frank", the GitHub repo link and "Made with Kiro" (kiro.dev).
- The title is **My Money Manager** while net worth is above zero, and **Scary Money Manager** at zero or below and on the entry screens. The browser tab title follows it.

## 15. Sample datasets (added after Task 12)
- The password screen offers **Try a sample** once the password is long enough: "Sample that ends below zero" and "Sample that ends above zero". Each deletes any existing database (after a warning), then creates one with the typed password holding opening balances, 25 transactions dated over the last 30 days up to today (IST), budgets and goals, so every tab has data.
