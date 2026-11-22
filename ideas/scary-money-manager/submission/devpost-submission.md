# Kiroween 2026: submission guide for Scary Money Manager

Sources: [Official Rules](https://kiroween.devpost.com/rules) and the [Overview](https://kiroween.devpost.com/) (read 22/Nov/2026). Deadline: **Friday 4 December 2026, 2:00 PM Pacific Time** (Saturday 5 December, 3:30 AM IST).

## 0. Fix these before you submit (hard requirements)

| Requirement (from the Rules) | Status on 22/Nov/2026 | What to do |
|---|---|---|
| Public GitHub repo | Public | Nothing |
| Open source licence file, detected and shown in the repo's About section | **Done**: MIT `LICENSE` at the root | After you push, check the About box shows "MIT license" |
| `/.kiro` directory at the repo root showing specs, hooks and steering, and not in `.gitignore` | **Done**: `.kiro/steering/` (4 files), `.kiro/specs/scary-money-manager/` (requirements, design, tasks), `.kiro/hooks/` (3 hooks); `.gitignore` does not list it | Commit and push `.kiro/` |
| URL to a working app | Live at https://julianfrank.github.io/kiroween2026/ | Also add it as the repo's Website in About |
| All source, assets and instructions needed to run it | `README.md` has build and run steps | Nothing |
| New project, built in the Submission Period (30 Oct to 4 Dec 2026) | First commit 22/Nov/2026 | Nothing |
| Demo video under 3 minutes, public on YouTube, no copyrighted music or third-party trademarks without permission | **Done**: https://youtu.be/ZyYEkYlSjp0 (also linked in the README) | Check it is public and under 3:00 |
| Eligibility | India is not on the excluded list | Nothing |

**Judging risk (decided: keep the AI required).** The app only opens after Chrome's on-device model is ready, so a judge without Gemini Nano (or on Edge, Safari or a phone) stops at the loader. The testing instructions (section 6) state the hardware clearly, and the video (section 13) must show the whole app working, because judges may judge from the video and text alone.

## 1. Elevator pitch

> A private money manager in one HTML file. Chrome's on-device AI turns plain words into balanced books, and the whole app gets spookier as your net worth sinks.

## 2. Project story ("About the project", Markdown)

Paste this, then edit it in your own voice. It uses plain text instead of LaTeX, because Devpost did not render inline math in list items.

```markdown
## Inspiration
Money apps want your bank login and send your spending to a server. I wanted the opposite: a money manager that never leaves your computer, that you can talk to in plain words ("I've taken a loan of Rs.5000 from Tom"), and that keeps real double-entry books. Chrome now ships Gemini Nano on the device, so the AI can stay local too. And since it's Kiroween, the app should get scarier as your finances do.

## What it does
- **One HTML file, fully offline.** Open it from disk or from GitHub Pages. No server, no account, no network calls after the model download.
- **Talk to it.** Each tab has a chat. The on-device model proposes an entry, the app checks it and does all the maths, and nothing is saved until you press Confirm.
- **Real bookkeeping.** Every entry balances (debits = credits), the ledger is append-only, and mistakes are fixed with a Reversal and a Correction. Setup opens only when **Assets = Liabilities + Opening Equity**.
- **Private by design.** Keys are opaque IDs; every value is encrypted with AES-256-GCM using a key derived from your password with PBKDF2-SHA256 (600,000 iterations). The password is never stored. Export, import, password change and "start over" are built in.
- **Dashboard.** Actual and Planned Sankey diagrams side by side, plus trends for income, spending, budgets, savings, goals, net worth and debts.
- **A theme that tells the truth.** The whole app is Light when your net worth is positive, Dark when it drops below zero, and Twilight when it is within 5% of your total assets either side of zero (|net worth| ≤ 5% of assets). The title even changes from "My Money Manager" to "Scary Money Manager". A ghost hand-writes a funny, true line about your situation, and every confirmed entry plays its own animation.
- **Made for India.** INR in whole rupees with lakh and crore grouping, dates in IST shown as DD/MMM/YYYY.

## How I built it
React 19 + TypeScript + Vite, bundled into a single file with vite-plugin-singlefile; d3 and d3-sankey for charts; Web Crypto and IndexedDB for the encrypted store; Chrome's Prompt API with a JSON-Schema `responseConstraint` for proposals. It was built with Kiro from an empty folder: a 28-question requirements interview, then a design and a 12-task plan, then one task at a time, each with its own tests and demo. 210 unit tests (including 8 fast-check property tests), 3 Playwright tests in real Chrome, Kiro hooks that run the tests on save and block logging of secrets, and a 36-sentence golden set that scores the real model in the browser (86% on the first run, 100% after the fixes).

## Challenges
- **The model can't be trusted with numbers.** It turned "30L" into 3 crore, and invented ₹100 crore for a sentence with no number. Now the app reads every amount from your own words; the model only picks which account and which kind of entry.
- **Testing a browser AI you can't run in CI.** A 36-sentence golden set runs inside the app against the real model. Three runs scored 31, 35 and then 36 of 36 (86% → 97% → 100%). Intents, amounts and dates were right every time, and every miss was an account name ("Petrol" instead of Transport, a blank or misplaced "HDFC Bank"). The fix was again to let the app read the user's own words, and each real reply is now a regression test.
- **A home loan booked as an asset** made an account go to −₹100 crore. New rules: accounts are only created where they can grow naturally, and anything named like a loan must be a liability.
- **Does the Prompt API work from `file://`?** Undocumented, so the first task was a spike. It does.
- **IST everywhere.** "Today" is the IST date whatever the computer's time zone; tests run the browser in New York to prove it.

## What I learned
Treat a small on-device model as a parser, never a calculator. Make the app do the arithmetic, the dates and the checks, and keep a human Confirm in the loop. Writing the decisions down first (glossary, ADRs, requirements) made every later change faster and safer.

## What's next
Recurring entries, bank-statement import, and more Indian regional languages for the chat.
```

## 3. Built with (up to 25 tags)

`kiro, react, typescript, vite, vite-plugin-singlefile, d3, d3-sankey, chrome-built-in-ai, prompt-api, gemini-nano, web-crypto-api, aes-gcm, pbkdf2, indexeddb, json-schema, svg, css-animations, vitest, testing-library, playwright, github-actions, github-pages, fast-check, double-entry-accounting, offline-first`

(25 tags. Swap `offline-first` for `pwa` only if you make it a PWA.)

## 4. Sponsor / special prizes

Kiro is the sponsor; there are no other sponsor tracks. Choose only the bonus prizes in section 9.

## 5. Category (choose one)

**Choose: Costume Contest.**

Why: the category asks for "a haunting user interface that's polished and unforgettable" with "spooky design elements that enhance your app's function". Here the spookiness is the function: the theme, title, ghost note and animations all report your real net worth.

Second choice: Frankenstein (on-device LLM + double-entry accounting + browser crypto + Sankey charts in one offline HTML file). Not a fit: Resurrection (no dead technology) and Skeleton Crew (needs a template and two separate apps in two folders).

## 6. Testing instructions (judges only)

```text
App: https://julianfrank.github.io/kiroween2026/  (or open dist/index.html from the repo)
No login. No server. All data stays in your browser.

Needs: Google Chrome on desktop (Windows 10/11, macOS 13+, Linux or Chromebook Plus) with Chrome's built-in AI
(Gemini Nano). The first run downloads the model (a few GB, about 22 GB free disk; GPU with more than 4 GB VRAM
or 16 GB RAM). Edge, Safari, Firefox and phones show an "unsupported" screen.

Fastest way in:
1. Wait for "Ready to Work" (press "Download and start" if asked).
2. Type any password of 7 or more characters, e.g. Kiroween-2026.
3. Press "Try a sample", then "Sample that ends below zero" (Dark theme) or "Sample that ends above zero" (Light).
4. Try the chat in Daily Updates: "Paid Rs.800 for groceries yesterday", then Confirm.
   In Liabilities: "I've taken a loan of Rs.5000 from Tom". In Budgets: "Set a monthly budget of 8000 for Food".
5. Watch the theme and the title change when a big expense takes net worth below zero.
6. Data and password tab: export (encrypted file), Export Template, import, change password, the AI check, start over.

To reset: Data and password > Start over (type DELETE), or start a new database from the password screen.
```

## 7. How the project meets the main technology requirement (uses Kiro)

Write only what is true. This is what was used to build the project:

- **Kiro IDE, agent chat in Autopilot:** built the whole project from an empty folder: planning, code, tests, debugging, deployment.
- **Skills:**
  - `grill-with-docs` (`grilling` plus `domain-modeling`): ran a 28-question requirements interview, one question at a time with every option. It produced `GLOSSARY.md`, four ADRs in `docs/adr/`, and the requirements, design and 12-task plan in `ideas/scary-money-manager/`.
  - `canvas-design`: the design philosophy for the entry screens (`design/entry-theme.md`).
  - `design-taste-frontend`: motion rules for the entry screens.
- **Steering:** `AGENTS.md` is loaded into every Kiro session as a workspace rule. It holds the status, the decisions Kiro must not change without asking, the rules learned from bugs ("never trust the model with amounts"), and the working rules.
- **Spec-driven development:** requirements (Q1–Q28) → design → 12 ordered tasks, each with named tests and a demo. Kiro implemented one task at a time and updated the plan and `AGENTS.md` after each.
- **Measuring the real model:** a golden set of 36 sentences runs in the app ("Check the AI"). Three runs scored 86%, 97% and then 100% (36 of 36). Kiro turned each failure into a regression test using the model's exact reply, then fixed the app to repair account names from the user's words. The report now prints the model's reply under each failure, so failures can be reproduced exactly.
- **Kiro tools:** web search and web fetch (Prompt API docs, current GitHub Actions versions), the shell (builds, Vitest, Playwright in real Chrome), and screenshots it read back to review its own UI.

- **`/.kiro` folder (in the repo):**
  - **Steering** (`.kiro/steering/`): `product.md`, `tech.md`, `structure.md` and `rules.md`. These are always included, so every Kiro session knows the product, the commands and the decisions it must not change without asking.
  - **Spec** (`.kiro/specs/scary-money-manager/`): `requirements.md` (the 28 interview decisions plus later changes, each tagged Q1 to Q28), `design.md` and `tasks.md` (12 tasks plus the later changes, each with its tests and demo).
  - **Agent hooks** (`.kiro/hooks/`):
    - `unit-tests-on-save` runs the Vitest suite whenever a source file is saved.
    - `no-secret-logs` is a PreToolUse guard that blocks any agent edit that would log a password, key or decrypted value. It enforces the rule "never log values or the key".
    - `update-status-on-stop` reminds the agent, when it finishes, to update the status and task list, confirm the checks ran, and respect the steering rules.
- **Property-based testing:** 8 fast-check properties in `src/properties.test.ts`, each tied to a requirement:
  - every entry balances and moves net worth by exactly what its kind says
  - reversing entries is the same as never posting them
  - rupee amounts survive formatting and parsing, and paise are always refused
  - the amount is read from a sentence however it is written (the "30L became 3 crore" bug)
  - setup opens if and only if Assets = Liabilities + Opening Equity
  - the Net Worth State boundaries hold
  - "today" is always the IST date
  - export then import keeps the books, and a wrong password changes nothing

  Honest result: they found no new bug, because the earlier fixes held. A mutation check showed they would: widening the Twilight band from 5% to 6%, or removing the date handling from the amount reader, made the properties fail at once. The minimal counterexamples were "Paid 100 on 22/Nov/2026" and a net worth just past the band.

Do not claim MCP, powers or custom agents. They were available in the session but not used for this project.
## 8. Pre-existing code or work

```text
No pre-existing project code. The repository was started on 22 Nov 2026, inside the Submission Period.
Standard open-source libraries: React, React DOM, d3, d3-sankey, Vite, vite-plugin-singlefile, TypeScript, Vitest,
Testing Library, jsdom, Playwright and fast-check. One asset: the GitHub mark icon from GitHub's Octicons (MIT licence).
The ghost artwork, the theme, the sample data and all app code were made for this project. No starter template.
Fonts are the computer's own system fonts.
```

## 9. Bonus prizes to enter

| Bonus prize | Enter? | Why |
|---|---|---|
| Best Demo | Yes (automatic) | No extra steps |
| Social Blitz | **Yes** | Needs one post (section 11) |
| Bonus Blog | **Yes** | Needs one blog post (section 12); 100 winners, so good odds |
| Best Ghost of Kiroween Past | **No** | You did not register for Kiroween 2025 |
| Best Startup Project | No, unless this is a real startup you founded | Needs your LinkedIn and the startup's website |
| Best Student Project | No, unless you are enrolled as a student | Needs your student email, school, year and degree |
| Best Kiro Crew App | No | The project was not built with Kiro Crew |

## 10. Startup bonus

Leave blank unless you are the founder of a real startup with a website.

## 11. Social Blitz post (must **start** with the hashtag; post between now and 4 Dec)

Example (LinkedIn or X), then edit it into your own words:

```text
#KiroweenHackathon26 My favourite thing about Kiro: it interviewed me before writing a line of code. 28 questions,
one at a time, every option laid out, and it wrote down the glossary and decisions as we went. Then it built my
money manager one task at a time, each with tests, and kept a running status file so every session picked up
where the last left off. I stopped vibe coding and started reviewing decisions. 👻
Scary Money Manager: a private, one-file money app where Chrome's on-device AI keeps the books and the theme turns
dark when your net worth does. https://julianfrank.github.io/kiroween2026/ @kirodotdev
```

## 12. Bonus Blog post (any third-party platform: dev.to, Medium, Hashnode, LinkedIn articles)

It must be public, about Kiro and the project, and say it is written for the Kiroween 2026 hackathon. Suggested outline:

1. "Written for the Kiroween 2026 hackathon": the idea in one paragraph.
2. Grill first: how the 28-question interview shaped the spec (and the decisions you changed later: paise to whole rupees, IST dates, a password screen with one field).
3. Spec to tasks: 12 tasks, each with tests and a demo, and `AGENTS.md` as the memory between sessions.
4. Bugs the AI introduced and how Kiro fixed them with rules: "30L" became 3 crore; a home loan became an asset.
5. Testing a browser AI you can't run in CI: a fake Prompt API in Playwright, plus the golden-sentence check on the real model.
6. Design: a theme driven by net worth, the crypt, the ghost that hand-writes your situation.
7. Links: the app, the repo, the video.

## 13. Demo video (under 3:00, public on YouTube, filmed in Chrome on your laptop)

| Time | Show |
|---|---|
| 0:00–0:15 | The problem: money apps want your data. This one is one file and never leaves your computer. |
| 0:15–0:35 | Open the file; the crypt loader goes "Checking → … → Ready to Work" (the on-device model). |
| 0:35–0:55 | Password screen; the ghost covers its eyes while you type. Start New Database; Setup with a backdated house; the imbalance reaches ₹0. |
| 0:55–1:35 | Chat: "I've taken a loan of Rs.5000 from Tom" → Confirm Card → coins animate. An expense in Daily Updates; a budget. |
| 1:35–2:05 | One big expense: net worth goes negative, the app turns dark, the title becomes "Scary Money Manager", the ghost writes a new line. |
| 2:05–2:30 | Dashboard: Actual and Planned Sankeys; Export and the encrypted file. |
| 2:30–2:55 | How Kiro built it: the grill interview, the spec and tasks, `AGENTS.md`, tests passing. |

Use your own narration or royalty-free music. Keep third-party logos to the Kiro and GitHub marks already in the app.

## 14. Repo "About" box

- **Description:** Private, single-file money manager: Chrome's on-device AI keeps double-entry books; the theme turns spooky as net worth sinks. Kiroween 2026.
- **Website:** https://julianfrank.github.io/kiroween2026/
- **Topics:** kiroween, kiro, chrome-built-in-ai, gemini-nano, personal-finance, react, typescript, d3
- **Licence:** MIT, shown automatically once `LICENSE` is pushed.
