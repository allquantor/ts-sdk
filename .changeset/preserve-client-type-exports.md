---
'@polymarket/client': patch
---

Preserve type-only binding re-exports in the published declarations. TypeScript now rejects using binding schemas such as `ApiKeySchema` as runtime values from the client root, matching its JavaScript exports.
