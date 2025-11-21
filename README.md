# julets - the agent-ready SDK for Jules

> **Disclaimer:** This is a 100% total, absolute, **just-for-fun** prototype.

## Making Jules Agent-Ready

Agents thrive on simple actions, persistent memory, and reactive updates. `julets` provides an tool and memory agent toolkit on top of the Jules REST API.

- **Tool Oriented:** Abstracts multi-step API choreographies into single, awaitable tool calls that an agent can easily execute. (e.g., `create session → poll for status → fetch result`)
- **Persistent State:** Provides external memory, retaining conversational context across turns without burdening your agent's context window.
- **Reactive Streams:** Converts passive REST polling into push-style Async Iterators, allowing your agent to efficiently _observe_ progress in real-time without managing complex polling logic.

## Core Usage

```ts
import { jules } from 'julets';

const session = jules.run({
  prompt: `Fix visibility issues in the examples/nextjs app. 
  
  **Visibility issues**
  - White text on white backgrounds
  - Low contrast on button hover

  **Instructions**
  - Update the global styles and page components to a dark theme with the shadcn zinc palette.
`,
  source: { github: 'davideast/julets', branch: 'main' },
});

for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'progressUpdated':
      console.log(`[BUSY] ${activity.title}`);
      break;
    case 'planGenerated':
      console.log(`[PLAN] ${activity.plan.steps.length} steps.`);
      break;
    case 'sessionCompleted':
      console.log('[DONE] Session finished successfully.');
      break;
    case 'sessionFailed':
      console.error(`[FAIL] ${activity.reason}`);
      break;
  }
}

// Get the pull-request URL once complete
const { pullRequest } = await session;
if (pullRequest) {
  console.log(`PR: ${pullRequest.url}`);
}
```

## Batch Processing

Process multiple items in parallel with `jules.all()`. This method is designed to feel like `Promise.all()` but with built-in concurrency control.

```javascript
const todos = ['Fix login bug', 'Update README', 'Refactor tests'];

// Processes items concurrently (default: 4 at a time)
const sessions = await jules.all(todos, (task) => ({
  prompt: task,
  source: { github: 'user/repo', branch: 'main' },
}));

// The results array preserves the order of the input array
console.log(`Created ${sessions.length} sessions.`);
```

For more control, you can pass an options object:

```javascript
const sessions = await jules.all(largeList, mapFn, {
  concurrency: 10, // Run 10 at a time
  stopOnError: false, // Don't stop if one fails
  delayMs: 500, // Wait 500ms between starting each item
});
```

### Rich Local Querying

The local cache can be queried instantly without network latency using the `.select()` method.

```typescript
// Query your local cache instantly without network latency.
const errors = await session.select({
  type: 'sessionFailed',
  limit: 10,
});
```

## Installation

```bash
npm i julets
# OR
bun add julets
```

## Cross-Platform Usage

The `julets` SDK is designed to work seamlessly in both Node.js and browser environments. It uses conditional exports in its `package.json` to automatically provide the correct implementation for your platform.

### Node.js (Default)

In a Node.js environment, the SDK defaults to using the local filesystem for caching session activities in a `.jules/cache` directory. This provides a persistent, restart-safe experience.

```typescript
// Imports the Node.js version by default
import { jules } from 'julets';

const session = await jules.session({
  prompt: 'Refactor the user authentication module.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
});
```

### Browser

When used in a browser environment (e.g., in a web application bundled with Vite, Webpack, or Rollup), the SDK automatically uses a browser-specific implementation that leverages IndexedDB for storage. This allows your web application to maintain session state locally.

> **Warning:** Never expose your `JULES_API_KEY` in a production or public-facing application. The browser module is designed for trusted client environments like Electron apps or websites running exclusively on a local machine.

To use the browser version, you can explicitly import it:

```typescript
// Explicitly import the browser-optimized version
import { jules } from 'julets/browser';

// The rest of your code remains the same
const session = await jules.session({
  prompt: 'Refactor the user authentication module.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
});
```

### Bundler Resolution vs. Explicit Imports

There are two primary strategies for handling platform-specific code, and `julets` is designed to support both.

1.  **Automatic Resolution (Recommended for most cases):** Modern bundlers that support the `exports` field in `package.json` can automatically select the correct file based on the environment. For example, Vite, when building for the browser, will see the `browser` condition in the `exports` map and use the `dist/browser.es.js` file. This is the ideal scenario, as it requires no changes to your import statements.

    ```typescript
    // In a browser environment, the bundler will automatically
    // resolve this to the browser-specific build.
    import { jules } from 'julets';
    ```

2.  **Explicit Imports:** In some cases, you may want to be explicit about which version you are using, or your tooling may not fully support conditional exports. In these situations, you can use a direct import path.

    ```typescript
    // Always imports the browser version, regardless of bundler configuration
    import { jules } from 'julets/browser';
    ```

**When to choose which?**

- Use the **default import (`julets`)** whenever possible. It's cleaner and relies on the standard module resolution features of the JavaScript ecosystem.
- Use the **explicit import (`julets/browser`)** if you need to override the bundler's resolution, if you are working in an environment that doesn't support conditional exports, or if you want to be very clear in your code that you are using the browser-specific version.

## Authentication / API Key

```bash
export JULES_API_KEY=<api-key>
```

## Interactive Usage

Use `jules.session()` for interactive workflows to observe, provide feedback, and guide the process. The `SessionClient` object maintains state across multiple interactions.

```typescript
import { jules } from 'julets';

const session = await jules.session({
  prompt: 'Refactor the user authentication module.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
});

console.log(`Session created: ${session.id}`);
console.log('Waiting for the agent to generate a plan...');

// Wait for the specific state where the plan is ready for review
await session.waitFor('awaitingPlanApproval');
console.log('Plan is ready. Approving it now.');
await session.approve();

// Ask a follow-up question
const reply = await session.ask(
  'Start with the first step and let me know when it is done.',
);
console.log(`[AGENT] ${reply.message}`);

// Wait for the final result of the session
const outcome = await session.result();
console.log(`✅ Session finished with state: ${outcome.state}`);
```

## Deep Dive

### Reactive Streams

Sessions progress is observed through the `.stream()` method that is available on both the `AutomatedSession` and `SessionClient` objects. An `AutomatedSession` is created via `jules.run()` and a `SessionClient` is create via `jules.session()`. The `.stream()` method returns an `AsyncIterator` to observe the agent's progress.

```typescript
for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'planGenerated':
      console.log(
        'Plan:',
        activity.plan.steps.map((s) => s.title),
      );
      break;
    case 'agentMessaged':
      console.log('Agent says:', activity.message);
      break;
    case 'sessionCompleted':
      console.log('Session complete!');
      break;
  }
}
```

### Artifacts (change sets, bash outputs, images)

Session progress is represented through an `Activity` object. Activities can contain artifacts, such as code changes (`changeSet`), shell output (`bashOutput`), or images (`media`). The SDK provides rich objects with helper methods for interacting with them.

```typescript
// (Inside a stream loop)
for (const artifact of activity.artifacts) {
  if (artifact.type === 'bashOutput') {
    // The .toString() helper formats the command, output, and exit code
    console.log(artifact.toString());
  }
  if (artifact.type === 'media' && artifact.format === 'image/png') {
    // The .save() helper works in both Node.js and browser environments
    await artifact.save(`./screenshots/${activity.id}.png`);

    // Get a URL for display or download (works cross-platform)
    const url = artifact.toUrl();
    console.log('Screenshot URL:', url);
  }
}
```

### Configuration

You can configure timeouts and polling intervals by creating a configured client.

#### Multiple API Keys

```typescript
import { jules } from 'julets';

// The default jules client initialized with process.env.JULES_API_KEY
const session = jules.session('<session-id-here>');

// Initializes a jules client with another API key
const customJules = jules.with({ apiKey: 'other-api-key' });
const session = customJules.session('<session-id-here>');
```

#### Polling & Timeouts

```typescript
import { jules } from 'julets';

const customJules = jules.with({
  pollingIntervalMs: 2000, // Poll every 2 seconds
  requestTimeoutMs: 60000, // 1 minute request timeout
});

// Use the jules client the same as the default
const session = jules.session('<session-id-here>');
```

### Error Handling

The SDK throws custom errors that extend a base `JulesError`. This makes it easy to catch all SDK-related exceptions.

```typescript
import { jules, JulesError } from 'julets';

try {
  const session = await jules.session({ ... });
} catch (error) {
  if (error instanceof JulesError) {
    console.error(`An SDK error occurred: ${error.message}`);
  } else {
    console.error(`An unexpected error occurred: ${error}`);
  }
}
```

## API Overview

This is a high-level overview of the main SDK components.

- **Core:**
  - `jules`: The pre-initialized client.
  - `jules.with(options)`: Creates a new client with custom configuration.
  - `jules.session()`: Creates or rehydrates a session. Returns a `SessionClient`.
- **Session Control:**
  - `session.ask()`: Sends a message and awaits the agent's reply.
  - `session.send()`: Sends a fire-and-forget message.
  - `session.approve()`: Approves a pending plan.
  - `session.waitFor()`: Pauses until the session reaches a specific state.
  - `session.waitForCompletion()`: Awaits the final outcome of the session.
- **Observation:**
  - `session.stream()`: Returns an async iterator of all activities (history + live).
  - `session.history()`: Returns a stream of locally cached activities.
  - `session.updates()`: Returns a stream of live activities from the network.
  - `session.select(query)`: Queries the local activity cache.
  - `session.info()`: Fetches the latest session state.
- **Artifact Management:**
  - `artifact.save()`: Decodes the base64 `data` and saves it. In Node.js, it writes to the filesystem. In the browser, it saves to IndexedDB.
  - `artifact.toUrl()`: Returns a `data:` URI for the artifact data, usable in both Node.js and browser.
  - `artifact.toString()`: Returns a formatted string that combines the command, exit code, `stdout`, and `stderr`, to simplify log display.
