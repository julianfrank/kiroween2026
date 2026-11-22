# Source is modular React and TypeScript, built into one HTML file

The product is distributed as a single `dist/index.html`. We keep a normal modular source tree (Vite, React 19, TypeScript, d3 and d3-sankey) and use `vite-plugin-singlefile` to inline everything. We rejected a hand-edited single file because crypto, ledger rules and chart data need unit tests, and rejected hand-written SVG charts in favour of d3-sankey for reliable Sankey layout.

## Consequences

- Building needs Node. Running the result needs only Chrome.
- If the Prompt API does not work from `file://` (to be tested in Task 2), the same file is served from `http://localhost` instead.
