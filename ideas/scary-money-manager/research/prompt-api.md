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
- Does the API run from a page opened as `file://`? The docs do not say. Result: **not yet tested**.
- Does the model download once per origin? A different `localhost` port may be a different origin and download again.
- Exact test-prompt behaviour on a loaded model and typical latency of a proposal.

## Design consequences
- Add a Start button before `create()`.
- Show the unsupported-device screen when `availability()` returns `unavailable`.
- Use `responseConstraint` for Proposed Entries.
