---
inclusion: always
---

# Structure

| What | Where |
|---|---|
| Status, code map, open items | `AGENTS.md` (read first) |
| Spec: requirements, design, tasks | `.kiro/specs/scary-money-manager/` |
| Steering (this folder) | `.kiro/steering/` |
| Agent hooks | `.kiro/hooks/` |
| Domain terms | `GLOSSARY.md` |
| Hard-to-reverse decisions | `docs/adr/` |
| Export format, entry-screen design, favicon, screenshots | `ideas/scary-money-manager/design/` |
| Research notes | `ideas/scary-money-manager/research/` |
| Devpost submission guide | `ideas/scary-money-manager/submission/` |
| Original brief | `ideas/.ignore/PROMPTS.md` |
| App source and unit tests (tests sit next to the code as `*.test.ts(x)`) | `src/` |
| End-to-end tests and the screenshot script | `e2e/` |
| Deployment | `.github/workflows/pages.yml` |

Inside `src/`: `ai/` (readiness, the one session), `chat/` (intents, proposals, drafts, amounts), `crypto/`, `store/` (KV, vault, repo), `money/`, `dates/`, `ledger/`, `rules/`, `setup/`, `targets/`, `charts/`, `export/`, `golden/`, `sample/`, `theme/`, `ui/`.

Only `README.md`, `AGENTS.md`, `GLOSSARY.md`, `LICENSE`, `docs/adr/`, `.kiro/`, `.github/` and build config live at the repo root. Never add `.kiro` to `.gitignore`.
