# AGENTS.md

This file contains instructions and context for AI agents (and humans) working on the `modjules` repository. Follow these guidelines to ensure code quality, stability, and consistency.

## 🚨 Pre-Commit Checklist

Before submitting any changes, you **MUST** perform the following steps. Failure to do so will likely result in CI failures.

1.  **Format Code:**
    - Run `npm run format` to automatically fix code style issues using Prettier.
    - Run `npm run format:check` to verify that formatting is correct.

2.  **Type Check:**
    - Run `npm run type-check` (which runs `tsc --project tsconfig.test.json`).
    - Fix **ALL** TypeScript errors. Do not suppress errors without a very strong reason.

3.  **Cleanup:**
    - **Revert Temporary Changes:** Ensure you have reverted any changes made for local debugging or environment setup (e.g., adding dev tools to `package.json`, creating `.env.local`, generating `*.log` files).
    - **Files:** Ensure no build artifacts or temporary files are committed.

## 🛠 Development Workflow

### Installation & Setup

- **Node.js Version:** Requires Node.js 18+ (due to usage of `global.fetch` and `node:crypto`).
- **Install Dependencies:** Run `npm install`.
- **Integrity Errors:** If you encounter `EINTEGRITY` errors (often after updating local `.tgz` dependencies), delete `package-lock.json` and `node_modules`, then run `npm install` again.

### Building

- **Build SDK:** Run `npm run build` from the root directory.
- **Local Packing:** To test the library in example apps or other local projects, run `npm run build` followed by `npm pack .`. This generates a `.tgz` file you can install elsewhere.

## 🧪 Testing Guidelines

We use **Vitest** for testing.

### Commands

- **Run All Unit Tests:** `npm test`
- **Run Integration Tests:** `npm run test:integration` (located in `tests/integration/`)
- **Run Browser Tests:** `npm run test:browser` (uses `jsdom` via `vitest.browser.config.ts`)

### Writing Tests

- **Imports:** Always import `vi` explicitly from 'vitest' (`import { vi } from 'vitest';`).
- **Platform Abstraction:**
  - Tests for the `Platform` interface (Node, Browser, GAS) follow a **Contract Suite** pattern.
  - Shared logic is in `tests/platform/contract.ts`.
  - Environment-specific runners are `tests/platform/node.test.ts`, `tests/platform/browser.test.ts`, and `tests/platform/gas.test.ts`.
  - When modifying `Platform`, update the Contract and ensure all three runners pass.
- **Google Apps Script (GAS):** Tests for GAS (`tests/platform/gas.test.ts`) use high-fidelity mocks for `UrlFetchApp` and `Utilities`. **Do not** rely on external GAS execution for unit tests.
- **Async Streams:** Testing the non-terminating `session.stream()` requires manual iterator control (calling `.next()` and `.return()`) to avoid timeouts.
- **Timeouts:** Integration tests in CI may require increased timeouts (e.g., 60000ms) for setup/teardown hooks.

## fq Codebase Architecture

### Core Concepts

- **Name:** The library is strictly referred to as **modjules** (formerly julets).
- **Platform Interface:** Environment-specific primitives (Fetch, Crypto, Filesystem) are isolated in `src/platform/`.
  - **Node:** `src/platform/node.ts` (Native Node APIs)
  - **Browser:** `src/platform/browser.ts` (Web Standards, IndexedDB)
  - **GAS:** `src/platform/gas.ts` (UrlFetchApp, Utilities)
- **Session:** Represents a stateful interaction. `session.stream()` is the core activity loop and is **non-terminating**.
- **Browser Bundle:** `modjules/browser` is for client-side use (trusted environments/local-only) and uses IndexedDB.

### React Usage

- There is no `useJules` hook.
- Use `useState` and `useEffect` to manage the `JulesClient` and `session.stream()`.
- Handle the stream concurrently to avoid blocking the UI thread.

## 📂 Examples & Sub-projects

### Next.js (`examples/nextjs` & `examples/jules-agent`)

- **Version:** Requires Next.js 16+ for full MCP support.
- **App Router:** Uses `src/app`.
- **Tailwind:** Requires `@tailwindcss/forms`, `@tailwindcss/typography`, and `@tailwindcss/container-queries` as devDependencies.
- **Environment:** Requires `JULES_API_KEY` in `.env.local`.
- **MCP:** The `jules-agent` example uses the Next.js Dev Server MCP.

## 🤖 CI/CD Context

- **Workflows:** Defined in `.github/workflows/ci.yml`.
- **Permissions:** Requires `contents: read` and `pull-requests: write`.
- **Secrets:** PRs from forks do not have access to secrets. Use `pull_request_target` if absolutely necessary and safe.
- **Hanging Processes:** If a script hangs in CI (especially `modjules.run`), ensure `process.exit(0)` is called explicitly.
