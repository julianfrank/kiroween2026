# Scary Money Manager

A private money manager in a single HTML file, built for Kiroween 2026. You describe money events in plain words. Chrome's on-device AI (Gemini Nano) turns them into balanced double-entry ledger entries. Every value is encrypted with your password and stays in your browser.

**Live app:** https://julianfrank.github.io/kiroween2026/

Open it in Google Chrome on a desktop (Windows, macOS, Linux or a Chromebook Plus). The first run downloads the on-device model, which needs about 22 GB of free disk space and a capable GPU or 16 GB of RAM. Other browsers do not have the built-in AI.

## Run it locally

The built app is one file, `dist/index.html`, and works when opened straight from disk.

```bash
npm ci
npm run build      # typecheck, then build dist/index.html
npm test           # unit tests
npm run test:e2e   # browser tests in your installed Google Chrome
```

## Deployment

Every push to `main` runs `.github/workflows/pages.yml`. It installs dependencies, runs the unit tests, builds `dist/index.html` and publishes it to GitHub Pages at the URL above. You can also run it by hand from the Actions tab ("Deploy to GitHub Pages", then "Run workflow").

## More

- Instructions and status for agent sessions: `AGENTS.md`
- Domain terms: `GLOSSARY.md`
- Decisions: `docs/adr/`
- Requirements, design and plan: `ideas/scary-money-manager/`

Author: Julian Frank. Made with [Kiro](https://kiro.dev).
