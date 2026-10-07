---
'@polymarket/client': patch
---

Preserve type-only re-exports in published declarations. TypeScript now rejects using binding schemas, client constructors, and other type-only exports as runtime values, matching the JavaScript exports of each client entry point.
