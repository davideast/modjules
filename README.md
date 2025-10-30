# julets - the agent-ready SDK for Jules

> **Disclaimer:** This is a 100% total, absolute, **just-for-fun** prototype.

## Making Jules Agent-Ready

Agents thrive on simple actions, persistent memory, and reactive updates. `julets` provides an tool and memory agent toolkit on top of the Jules REST API.

- **Tool Oriented:** Abstracts multi-step API choreographies into single, awaitable tool calls that an agent can easily execute. (e.g., `create session → poll for status → fetch result`)
- **Persistent State:** Provides external memory, retaining conversational context across turns without burdening your agent's context window.
- **Reactive Streams:** Converts passive REST polling into push-style Async Iterators, allowing your agent to efficiently _observe_ progress in real-time without managing complex polling logic.

## Core Usage

```ts
import { Jules } from 'julets';

const jules = Jules();
const session = jules.run({
  prompt: 'Add a Next.js usage example to README.md',
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

// Await the automated session to get the PR URL
const { pullRequest } = await session;
if (pullRequest) {
  console.log(`PR: ${pullRequest.url}`);
}
```

## Installation

```bash
npm i julets
# OR
bun add julets
```

## Authentication / API Key

```bash
export JULES_API_KEY=<api-key>
```

## Interactive Usage

Use `jules.session()` for interactive workflows where an agent (or human) needs to observe, provide feedback, and guide the process. The `SessionClient` object maintains state across multiple interactions.

```typescript
import { Jules } from 'julets';

const jules = Jules();
const session = await jules.session({
  prompt:
    'Refactor the user authentication module together. Show me your plan first.',
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

Both `AutomatedSession` and `SessionClient` objects provide a `.stream()` method that returns an Async Iterator. This is the primary way to observe the agent's progress.

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

Activities can contain artifacts, such as code changes (`changeSet`), shell output (`bashOutput`), or images (`media`). The SDK provides rich objects with helper methods for interacting with them.

```typescript
// (Inside a stream loop)
for (const artifact of activity.artifacts) {
  if (artifact.type === 'bashOutput') {
    // The .toString() helper formats the command, output, and exit code
    console.log(artifact.toString());
  }
  if (artifact.type === 'media' && artifact.format === 'image/png') {
    // The .save() helper works in Node.js environments
    await artifact.save(`./screenshots/${activity.id}.png`);
  }
}
```

### Configuration

You can configure timeouts and polling intervals when initializing the client.

```typescript
const jules = Jules({
  config: {
    pollingIntervalMs: 2000, // Poll every 2 seconds
    requestTimeoutMs: 60000, // 1 minute request timeout
  },
});
```

### Error Handling

The SDK throws custom errors that extend a base `JulesError`. This makes it easy to catch all SDK-related exceptions.

```typescript
import { Jules, JulesError } from 'julets';

try {
  const outcome = await jules.run({ ... });
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
  - `Jules()`: The main factory function to initialize the client.
  - `jules.run()`: Starts an automated, fire-and-forget task. Returns a `AutomatedSession` promise.
  - `jules.session()`: Creates or rehydrates an interactive session. Returns a `SessionClient`.
- **Session Control:**
  - `session.ask()`: Sends a message and awaits the agent's reply.
  - `session.send()`: Sends a fire-and-forget message.
  - `session.approve()`: Approves a pending plan.
  - `session.waitFor()`: Pauses until the session reaches a specific state.
- **Observation:**
  - `run.stream()` / `session.stream()`: Returns an async iterator of all activities.
  - `session.result()`: Awaits the final outcome of the session.
  - `session.info()`: Fetches the latest session state.
- **Utilities:**
  - `jules.sources`: A manager to list and get available code sources.
    - `jules.sources()`: Async iterator for all sources.
    - `jules.sources.get({ github: '...' })`: Finds a specific GitHub repository.
