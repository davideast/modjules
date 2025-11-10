---
'julets': minor
---

🚀 **Feature: Local-first Synchronization Engine**

Introduced a new `ActivityClient` accessible via `session.activities()`. This is now the recommended way to interact with session activities, offering robust, restart-safe streaming and rich local querying.

```typescript
const session = jules.session(id);

// 1. Robust Hybrid Streaming (History + Live Updates)
// Automatically caches to disk and deduplicates events across restarts.
for await (const act of session.activities().stream()) {
  console.log(act.type, act.id);
}

// 2. Rich Local Querying
// Query your local cache instantly without network latency.
const errors = await session.activities().select({
  type: 'sessionFailed',
  limit: 10,
});
```

- Added `ActivityStorage` with Node.js filesystem persistence by default.
- Added explicit streaming modalities: `.history()` (cold) and `.updates()` (hot).
