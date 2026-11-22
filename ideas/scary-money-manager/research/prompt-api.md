# Research: Chrome Prompt API

Source: https://developer.chrome.com/docs/ai/prompt-api (fetched 2026-11-22). Content below is paraphrased.

## Verified from the docs
- `LanguageModel.availability(options)` reports whether the model can be used. Pass the same options later given to `create()` or `prompt()`.
- `LanguageModel.create({ monitor })` triggers the download. Use `monitor(m) { m.addEventListener('downloadprogress', e => e.loaded) }` for progress (`e.loaded` is 0 to 1). Starting the download requires user activation, so use a Start button.
- `prompt()` takes `responseConstraint` (JSON Schema or regex) to force structured output. The constraint uses some of the context window, and `omitResponseConstraintInput` avoids that.
- A session keeps conversation context. `session.contextUsage` and `session.contextWindow` show progress to the limit.
- `session.destroy()` ends a session. A later `prompt()` is rejected with an error. (The user pointed to this in the docs.)
- Requirements: Windows 10/11, macOS 13+, Linux, or ChromeOS on Chromebook Plus. At least 22 GB free on the profile volume. A GPU with more than 4 GB VRAM, or 16 GB RAM and 4 cores. The model is removed if free space drops below 10 GB after download. The network is needed only for the first download.
- The model is downloaded separately the first time an origin uses the API (so the origin matters).

## Open (to resolve in Task 2)
- Does the API run from a page opened as `file://`? The docs do not say. Result (2026-11-22, Windows): **works from `file://` in Chrome.** `isSecureContext` true, `crypto.subtle` and IndexedDB available, `availability()` returned `available`, a session was created, the test prompt replied "ready", and `prompt()` after `destroy()` rejected with `InvalidStateError: ... The model execution session has been destroyed.` (this is the error type tests should assert). **Edge does not expose `LanguageModel`** (`API missing`), so the unsupported-device screen must name Chrome as the required browser and handle a missing API, not only `unavailable`. How the spike page was run: the spike page is built (`npm run build`, then open `dist/index.html` from disk in Chrome and press Start). It reports protocol, `isSecureContext`, `crypto.subtle`, IndexedDB, `LanguageModel.availability()`, download progress, a test reply, and whether `prompt()` rejects after `destroy()`. Record the output here.

Built file size with React 19 only (no d3 yet): 430,854 bytes.
- Does the model download once per origin? A different `localhost` port may be a different origin and download again.
- Exact test-prompt behaviour on a loaded model and typical latency of a proposal.

## Design consequences
- Add a Start button before `create()`.
- Show the unsupported-device screen when `availability()` returns `unavailable`.
- Use `responseConstraint` for Proposed Entries.

## Context usage names (Task 12)
- The current docs use `session.contextUsage` and `session.contextWindow`. Older Chrome builds used `inputUsage` and `inputQuota`. `AiHost` reads either, rebuilds at 80%, and also recovers once from `QuotaExceededError`.

## Golden-sentence accuracy (Task 12)
- Not yet measured. Run "Data and password" > "Check the AI" in Chrome with the real model and record the report here (date, Chrome version, score, repeated failures).
