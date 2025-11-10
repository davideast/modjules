# julets

## 0.1.0

### Minor Changes

- [#70](https://github.com/davideast/julets/pull/70) [`61a9da2`](https://github.com/davideast/julets/commit/61a9da255d3dcf031f4ddead53bce299b251a619) Thanks [@davideast](https://github.com/davideast)! - 🚀 **Feature: Local-first Synchronization Engine**

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

### Patch Changes

- [#70](https://github.com/davideast/julets/pull/70) [`61a9da2`](https://github.com/davideast/julets/commit/61a9da255d3dcf031f4ddead53bce299b251a619) Thanks [@davideast](https://github.com/davideast)! - fix: Improved network reliability.
  - Implemented robust polling in `NetworkAdapter` to ensure infinite streams never drop connections silently.
  - Standardized all internal activity fetching through the new `NetworkClient` interface.
