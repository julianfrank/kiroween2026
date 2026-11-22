# Research: other topics

Status: **notes from prior knowledge, not yet verified against current sources.** Each item has a verification step in the task that needs it.

## Web Crypto: PBKDF2 and AES-GCM (verify in Task 4)
- `crypto.subtle` is available in secure contexts. Chrome treats `file://` pages as potentially trustworthy, but this must be checked in the Task 2 spike.
- PBKDF2-SHA256 at about 600,000 iterations matches current OWASP guidance for that algorithm. Argon2 and scrypt are stronger but not built in (decision in Q4).
- AES-GCM needs a unique IV per encryption under the same key. Use a random 12-byte IV per value. With a random 96-bit IV, keep the number of encryptions per key well below 2^32 (a personal ledger is far below this).
- Measure derivation time on the target machine. Show a "deriving key" indicator.
- Store the derived key as a non-extractable `CryptoKey` in memory only.

## d3-sankey limits (verify in Task 9)
- d3-sankey needs an acyclic graph. A cycle throws an error. So "Drawn from savings" must be its own source node, separate from the savings target node.
- Zero-value links should be filtered out. Very small links need a minimum visual width.
- Node order should be stable between the Actual and Planned diagrams so they compare easily.

## Build and bundle size (verify in Task 2)
- `vite-plugin-singlefile` inlines JS and CSS into one HTML. Expect React 19 plus d3 and d3-sankey to total a few hundred KB, which is fine for local use.
- Measure the actual size after the scaffold and record it here.

## Lakh/crore formatting (Task 5)
- `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` gives `₹1,20,000.00` grouping. Use it for display and keep parsing separate.
- Parsing must accept `Rs.5000`, `Rs 5,000`, `₹5000`, `5k`, `1.2L`, `1.5cr`. Parsing happens in app code, not the model.

## Regional-language input (Task 7, optional)
- Gemini Nano's supported languages are limited, and `availability()` takes `expectedInputs` languages. Start with English. Test Hindi sentences in the golden set and record the result. Not a requirement.

## Date parser: library vs hand-written (Task 7)
- The supported phrases are few (today, yesterday, N days ago, last weekday, ISO dates, "on 3 Nov"). A small hand-written resolver with an injected "today" is easier to test and adds no bundle weight. Revisit only if the golden set shows many unsupported phrases.

## IndexedDB quotas (Task 4)
- Chrome's quota is large (a percentage of free disk), and a personal ledger is a few MB at most. Call `navigator.storage.persist()` to reduce the chance of eviction, and show a warning if it is denied.
- Encrypted values are base64 text, so expect about 33% overhead.
