# modjules

## 0.1.1

### Patch Changes

- [#81](https://github.com/davideast/julets/pull/81) [`d1d0f46`](https://github.com/davideast/julets/commit/d1d0f46e6dd4911608cff9a6b82bcd7fbae82786) Thanks [@davideast](https://github.com/davideast)! - 🚀 **Feature: Browser Artifact Saving & Universal `toUrl()`**

  This release expands cross-platform capabilities by enabling `artifact.save()` in browser environments and introducing a universal `toUrl()` method for media artifacts.

  ### 🌐 Browser Artifact Saving

  The `MediaArtifact.save(filepath)` method now works in browser environments. Instead of writing to a local filesystem, it saves the artifact to an `artifacts` object store within the `julets-activities` IndexedDB. This acts as a virtual filesystem for user-saved content within the browser.

  ### 🔗 Universal `toUrl()` Method

  A new `toUrl()` method has been added to `MediaArtifact`. It returns a URL string that can be used to display or download the media, working seamlessly across platforms:
  - **Browser:** Returns a `data:` URI.
  - **Node.js:** Returns a `data:` URI.

  ```typescript
  // Works in both Node.js and Browser
  if (artifact.type === 'media') {
    const url = artifact.toUrl();
    console.log('Artifact URL:', url);
    // Browser: use in <img src={url} />
    // Node.js: uses comaptible scheme: `data:${mimeType};base64,${data}`;
  }
  ```

- [#78](https://github.com/davideast/julets/pull/78) [`1b3b12f`](https://github.com/davideast/julets/commit/1b3b12f42111284fdeecb2ca11eee6ed247bc46d) Thanks [@davideast](https://github.com/davideast)! - 🚀 **Feature: Cross-Platform Support (Node.js & Browser)**

  The `julets` SDK now officially supports both Node.js and browser environments. This is achieved through a major architectural refactoring that introduces platform-specific implementations and conditional exports, ensuring that only the necessary code is bundled for each environment.

  ### Browser Support via IndexedDB

  The new `BrowserStorage` implementation uses IndexedDB to persist session activities, providing a robust, local-first experience for web applications.

  ### Architectural Improvements
  - **Dependency Injection:** The core SDK client now uses dependency injection for its storage and platform layers, removing the need for runtime environment checks (`isNode`).
  - **Platform Abstraction:** A new `Platform` interface abstracts platform-specific APIs (like `fs` and `timers`), with `NodePlatform` and `BrowserPlatform` implementations.
  - **Conditional Exports:** The `package.json` `exports` field now correctly points to platform-specific, ESM-only builds, allowing modern bundlers to automatically select the correct implementation.

  ### New Usage for Cross-Platform Imports

  You can now import the SDK in both Node.js and browser environments.

  **Node.js (Default):**

  ```typescript
  // Imports the Node.js version by default, using filesystem storage.
  import { jules } from 'julets';
  ```

  **Browser:**
  While modern bundlers will automatically resolve the correct entry point, you can also explicitly import the browser version:

  ```typescript
  // Explicitly import the browser-optimized version, using IndexedDB storage.
  import { jules } from 'julets/browser';
  ```

- [#80](https://github.com/davideast/julets/pull/80) [`b13f23b`](https://github.com/davideast/julets/commit/b13f23bb0ae7484cddd5bdaf8b33c339be612b8b) Thanks [@davideast](https://github.com/davideast)! - 🚀 **API Simplification: `SessionClient` Methods**

  To create a more intuitive and streamlined developer experience, the primary methods for observing session activities have been promoted from the `ActivityClient` directly onto the `SessionClient`. The `.activities()` namespace has been removed from the public API.

  This change reduces the number of concepts a developer needs to learn and makes the API feel more direct and ergonomic. The `ActivityClient` remains as a powerful internal abstraction for managing the local-first cache and network synchronization.

  ### Before

  ```typescript
  // Old way: Accessing methods through the .activities() getter
  const history = await session.activities().history();
  const updates = await session.activities().updates();
  const selection = await session
    .activities()
    .select({ type: 'planGenerated' });
  ```

  ### After

  ```typescript
  // New, direct way: Methods are available on the session client
  const history = await session.history();
  const updates = await session.updates();
  const selection = await session.select({ type: 'planGenerated' });
  ```

  This is a breaking change for users who were using the `session.activities()` methods directly. The migration path is to simply remove the `.activities()` call.

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
