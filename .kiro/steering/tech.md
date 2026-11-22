---
inclusion: always
---

# Tech

- **Stack:** Vite 8, React 19, TypeScript (strict), d3 and d3-sankey, `vite-plugin-singlefile`. Output is one self-contained `dist/index.html` that works from `file://` and from GitHub Pages.
- **Browser APIs:** Prompt API (`LanguageModel`, `responseConstraint` JSON Schema), Web Crypto (PBKDF2-SHA256 600k iterations, AES-256-GCM), IndexedDB.
- **Tests:** Vitest (unit, React Testing Library with jsdom, fast-check property tests), Playwright in the installed Google Chrome with a fake Prompt API (`e2e/`).
- **CI and hosting:** `.github/workflows/pages.yml` runs `npm ci`, `npm test`, `npm run build` and publishes `dist/` to GitHub Pages on every push to `main`.

## Commands
- `npm run build`: typecheck, then build `dist/index.html`.
- `npm test`: all Vitest tests, including a check that the build is one self-contained file.
- `npm run test:e2e`: build, then the Playwright tests in headless Chrome (New York time zone, to prove dates follow IST).
- `node e2e/shots.mjs`: screenshots of the main screens into `ideas/scary-money-manager/design/shots/` (after a build).

Run build, unit tests and e2e before calling a change done. Do not start long-running dev servers from the agent shell; ask the user to run them. On Windows PowerShell chain commands with `;`.
