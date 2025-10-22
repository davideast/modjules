# `julets` (Unofficial Jules SDK)

**The agent-ready SDK for Jules.**

> **Disclaimer:** This is a prototype SDK and is not officially supported by Google. The API is subject to change.

## The "Why": Making Jules Agent-Ready

Agentic loops thrive on simple actions, persistent memory, and reactive updates. Raw REST APIs, by contrast, are often stateless, complex, and require constant polling. `julets` bridges this gap, transforming the powerful Jules API into a toolkit that is truly "agent-ready."

- **Tool Oriented:** Abstracts multi-step API choreographies (e.g., create session → poll for status → fetch result) into single, awaitable tool calls that an agent can easily execute.
- **Persistent State:** The `Session` object acts as external memory, retaining conversational context across turns without burdening your agent's context window.
- **Reactive Streams:** Converts passive REST polling into push-style Async Iterators, allowing your agent to efficiently *observe* progress in real-time without managing complex polling logic.

## Installation & Authentication

```bash
npm install julets
```

The SDK requires a Jules API key. It will automatically look for it in the `JULES_API_KEY` environment variable.

```bash
export JULES_API_KEY="your-api-key-here"
```

## Quickstart 1: Automation (Atomic Action)

Use `jules.run()` when you need to treat a complex task as a single, atomic "Tool Call." The agent fires off the request and simply waits for the final result.

```typescript
import { Jules } from 'julets';

const jules = Jules();

async function fixBug() {
  console.log('Starting automated run to fix the bug...');
  const automatedSession = jules.run({
    prompt: 'The login button is not working on Safari. Please investigate and create a PR with the fix.',
    source: {
      github: 'your-org/your-repo',
      branch: 'main',
    },
    // autoPr is true by default for jules.run()
  });

  // You can stream progress while waiting for the final result
  for await (const activity of automatedSession.stream()) {
    if (activity.type === 'progressUpdated') {
      console.log(`[AGENT] ${activity.title}: ${activity.description}`);
    }
  }

  // The `automatedSession` object is a Promise that resolves to the final outcome
  const outcome = await automatedSession;

  if (outcome.state === 'completed' && outcome.pullRequest) {
    console.log(`✅ Success! PR created: ${outcome.pullRequest.url}`);
  } else {
    console.error(`❌ Run failed. Session ID: ${outcome.sessionId}`);
  }
}

fixBug();
```

## Quickstart 2: Interactive (Reactive State)

Use `jules.session()` for interactive workflows where an agent (or human) needs to observe, provide feedback, and guide the process. The `SessionClient` object maintains state across multiple interactions.

```typescript
import { Jules } from 'julets';

const jules = Jules();

async function interactiveRefactor() {
  const session = await jules.session({
    prompt: 'Let\'s refactor the user authentication module together. Show me your plan first.',
    source: {
      github: 'your-org/your-repo',
      branch: 'develop',
    },
    // requireApproval is true by default for jules.session()
  });

  console.log(`Session created: ${session.id}`);
  console.log('Waiting for the agent to generate a plan...');

  // Wait for the specific state where the plan is ready for review
  await session.waitFor('awaitingPlanApproval');
  console.log('Plan is ready. Approving it now.');
  await session.approve();

  // Ask a follow-up question
  const reply = await session.ask('Great, please start with the first step and let me know when it is done.');
  console.log(`[AGENT] ${reply.message}`);

  // Wait for the final result of the session
  const outcome = await session.result();
  console.log(`✅ Session finished with state: ${outcome.state}`);
}

interactiveRefactor();
```

## Deep Dive

### Reactive Streams

Both `AutomatedSession` and `SessionClient` objects provide a `.stream()` method that returns an Async Iterator. This is the primary way to observe the agent's progress in real time.

```typescript
for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'planGenerated':
      console.log('Plan:', activity.plan.steps.map(s => s.title));
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

## API Map

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
