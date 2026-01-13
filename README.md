# modjules

> Status: Useful tool but still experimental. Supported and moving fast to improve.

## A programmable SDK and MCP server to pair with IDEs/CLIs

Agents thrive on simple actions, persistent memory, and reactive updates. `modjules` provides a tool and memory agent toolkit on top of the Jules REST API.

- **MCP Server:** Delegate tasks from Antigravity, Claude Code, Cursor, or any MCP client to Jules - hand off a refactor, check on progress, review the diff, decide when to merge.
- **Tool Oriented:** Abstracts multi-step API choreographies into single, awaitable tool calls. (e.g., `create session → poll for status → fetch result`)
- **Persistent State:** Retains conversational context across turns without burdening your agent's context window.
- **Reactive Streams:** Converts REST polling into push-style Async Iterators for real-time progress.

## SDK

```ts
import { jules } from 'modjules';

const session = await jules.session({
  prompt: `Fix visibility issues in the examples/nextjs app.

  **Visibility issues**
  - White text on white backgrounds
  - Low contrast on button hover

  **Instructions**
  - Update the global styles and page components to a dark theme with the shadcn zinc palette.
`,
  source: { github: 'davideast/modjules', branch: 'main' },
  autoPr: true,
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

## MCP Server

Use Jules as a tool in Claude Code, Cursor, or any MCP client. Your assistant can delegate tasks to Jules, check progress, review changes, and decide when to merge.

```json
{
  "mcpServers": {
    "modjules": {
      "command": "npx",
      "args": ["-y", "@modjules/mcp"],
      "env": { "JULES_API_KEY": "<your-key>" }
    }
  }
}
```

Now you can ask your assistant things like:

- _"Create a Jules session to fix the auth bug in my-org/my-repo"_
- _"What files did Jules change? Show me the diffs before I merge."_
- _"Check if the tests passed in that Jules session"_

## Installation (SDK)

```bash
npm i modjules
export JULES_API_KEY=<api-key>
```

---

## Deep Dive

### Batch Processing

Process multiple items in parallel with `jules.all()`. Feels like `Promise.all()` but with built-in concurrency control.

```javascript
const todos = ['Fix login bug', 'Update README', 'Refactor tests'];

const sessions = await jules.all(todos, (task) => ({
  prompt: task,
  source: { github: 'user/repo', branch: 'main' },
}));

console.log(`Created ${sessions.length} sessions.`);
```

For more control:

```javascript
const sessions = await jules.all(largeList, mapFn, {
  concurrency: 10,
  stopOnError: false,
  delayMs: 500,
});
```

### Interactive Sessions

Use `jules.session()` for workflows where you observe, provide feedback, and guide the process.

```typescript
const session = await jules.session({
  prompt: 'Refactor the user authentication module.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
});

console.log(`Session created: ${session.id}`);

await session.waitFor('awaitingPlanApproval');
console.log('Plan is ready. Approving it now.');
await session.approve();

const reply = await session.ask(
  'Start with the first step and let me know when it is done.',
);
console.log(`[AGENT] ${reply.message}`);

const outcome = await session.result();
console.log(`Session finished with state: ${outcome.state}`);
```

### Local Querying

The local cache can be queried instantly without network latency.

```typescript
const errors = await session.select({
  type: 'sessionFailed',
  limit: 10,
});
```

### Reactive Streams

The `.stream()` method returns an `AsyncIterator` to observe the agent's progress.

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

### Artifacts

Activities can contain artifacts: code changes (`changeSet`), shell output (`bashOutput`), or images (`media`).

```typescript
for (const artifact of activity.artifacts) {
  if (artifact.type === 'bashOutput') {
    console.log(artifact.toString());
  }
  if (artifact.type === 'changeSet') {
    const parsed = artifact.parsed();
    for (const file of parsed.files) {
      console.log(`${file.path}: +${file.additions} -${file.deletions}`);
    }
  }
  if (artifact.type === 'media' && artifact.format === 'image/png') {
    await artifact.save(`./screenshots/${activity.id}.png`);
  }
}
```

### Repoless Sessions

Create sessions without a GitHub repo for general coding tasks, code review, or learning.

```typescript
// No source required - context comes from your prompt
const session = await jules.run({
  prompt: `Create a TypeScript user service with:
  - User interface with id, name, email
  - fetchUserData async function
  - processUsers batch function using Promise.allSettled`,
});

// Access generated code from session outputs
const info = await session.info();
for (const output of info.outputs) {
  if (output.type === 'changeSet') {
    const parsed = output.parsed();
    for (const file of parsed.files) {
      console.log(`${file.path}: +${file.additions} -${file.deletions}`);
      console.log(file.content);
    }
  }
}
```

### Cross-Platform

Works in Node.js (filesystem caching) and browser (IndexedDB).

```typescript
// Node.js - default
import { jules } from 'modjules';

// Browser - test only, never expose API keys in production
import { jules } from 'modjules/browser';
const testJules = jules.with({
  apiKey_TEST_ONLY_DO_NOT_USE_IN_PRODUCTION: '...',
});
```

For production browser apps, use [`@modjules/server`](./packages/server) to proxy requests.

### Configuration

```typescript
// Multiple API keys
const customJules = jules.with({ apiKey: 'other-api-key' });

// Polling & timeouts
const customJules = jules.with({
  pollingIntervalMs: 2000,
  requestTimeoutMs: 60000,
});
```

### Error Handling

```typescript
import { jules, JulesError } from 'modjules';

try {
  const session = await jules.session({ ... });
} catch (error) {
  if (error instanceof JulesError) {
    console.error(`SDK error: ${error.message}`);
  }
}
```

### Autonomous CI

Report CI results back to Jules. When Jules creates a PR, your CI can send test failures or build errors back so Jules can iterate.

```typescript
// scripts/ci-report.ts
import { jules } from 'modjules';

const prBody = process.env.PR_BODY;
const testOutput = process.env.TEST_OUTPUT;

// Parse session ID from Jules PR body
const sessionId = prBody.match(/session[\/:](\d+)/i)?.[1];
if (!sessionId) process.exit(0);

const session = await jules.session(sessionId);
await session.send(`CI failed. Here's the output:\n\n${testOutput}`);
```

```yaml
# .github/workflows/ci.yml
- name: Report to Jules
  if: failure() && github.event.pull_request.user.login == 'google-labs-jules[bot]'
  env:
    JULES_API_KEY: ${{ secrets.JULES_API_KEY }}
    PR_BODY: ${{ github.event.pull_request.body }}
    TEST_OUTPUT: ${{ steps.test.outputs.log }}
  run: npx tsx scripts/ci-report.ts
```

### MCP Tools Reference

| Tool                     | Description                  |
| ------------------------ | ---------------------------- |
| `jules_create_session`   | Start a new Jules task       |
| `jules_session_state`    | Check status, get PR links   |
| `jules_session_files`    | See what files changed       |
| `jules_get_code_changes` | Review code diffs            |
| `jules_get_bash_outputs` | See test results, build logs |
| `jules_interact`         | Approve plans, ask questions |
| `jules_sync`             | Pull latest into cache       |
| `jules_select`           | Query cached data            |

### API Overview

- **Core:**
  - `jules`: The pre-initialized client.
  - `jules.with(options)`: Creates a new client with custom configuration.
  - `jules.run(options)`: Creates an automated session.
  - `jules.session(options)`: Creates or rehydrates an interactive session.
  - `jules.all(items, mapFn, options)`: Batch processing.
- **Session Control:**
  - `session.ask()`: Sends a message and awaits the agent's reply.
  - `session.send()`: Sends a fire-and-forget message.
  - `session.approve()`: Approves a pending plan.
  - `session.waitFor()`: Pauses until the session reaches a specific state.
  - `session.result()`: Awaits the final outcome.
- **Observation:**
  - `session.stream()`: Async iterator of all activities.
  - `session.history()`: Stream of cached activities.
  - `session.updates()`: Stream of live activities.
  - `session.select(query)`: Query local cache.
  - `session.info()`: Fetch latest session state.
- **Artifacts:**
  - `artifact.save()`: Save to filesystem or IndexedDB.
  - `artifact.toUrl()`: Get data URI.
  - `artifact.toString()`: Formatted output for bash artifacts.
  - `artifact.parsed()`: Structured diff parsing for changesets.

### Packages

| Package                                 | Description |
| --------------------------------------- | ----------- |
| [`modjules`](./packages/core)           | Core SDK    |
| [`@modjules/mcp`](./packages/mcp)       | MCP server  |
| [`@modjules/server`](./packages/server) | Auth proxy  |

## License

ISC
