# julets - The TypeScript SDK for Jules

`julets` is the official TypeScript SDK for interacting with the Jules API. It provides a developer-friendly interface for automating and managing software development tasks with Jules.

## Getting Started

### Installation

To get started, install the `julets` package from npm:

```bash
npm install julets
```

### Authentication

The SDK requires a Jules API key to authenticate with the API. You can provide the key in one of two ways:

1.  **Environment Variable (Recommended)**: Set the `JULES_API_KEY` environment variable. The SDK will automatically detect and use it.

    ```bash
    export JULES_API_KEY="your-api-key"
    ```

2.  **Client Configuration**: Pass the API key directly when initializing the client.

    ```ts
    import { Jules } from 'julets';

    const jules = Jules({
      apiKey: 'your-api-key',
    });
    ```

## Core Concepts

The `julets` SDK is designed around two primary interaction models, each tailored for different use cases:

-   **`AutomatedSession` (`jules.run()`)**: Ideal for "fire-and-forget" tasks. You provide a prompt and a source, and Jules works autonomously to complete the task and (optionally) create a pull request. This is best for straightforward, automated workflows.

-   **`SessionClient` (`jules.session()`)**: Perfect for interactive workflows where you need to guide, observe, and interact with the agent. This model allows you to send and receive messages, approve plans, and wait for specific states, giving you fine-grained control over the session.

## Usage

### Automated Usage (`jules.run()`)

This is the simplest way to use Jules. The `jules.run()` method returns an `AutomatedSession` object, which is a "thenable" that resolves with the final outcome of the session. You can also use its `.stream()` method to observe the agent's progress in real-time.

```ts
import { Jules } from 'julets';

const jules = Jules();

async function main() {
  const session = jules.run({
    prompt: 'Add a Next.js usage example to the README.md',
    source: { github: 'davideast/julets', branch: 'main' },
  });

  // You can optionally stream the activities as they happen
  for await (const activity of session.stream()) {
    if (activity.type === 'progressUpdated') {
      console.log(`[PROGRESS] ${activity.title}`);
    }
  }

  // Await the session to get the final result
  const outcome = await session;

  if (outcome.state === 'COMPLETED' && outcome.outputs.length > 0) {
    const pr = outcome.outputs[0].pullRequest;
    if (pr) {
      console.log(`✅ Pull Request created: ${pr.url}`);
    }
  } else if (outcome.state === 'FAILED') {
    console.error(`❌ Session failed.`);
  }
}

main();
```

### Interactive Usage (`jules.session()`)

For more complex tasks that require human-in-the-loop interaction, use `jules.session()`. This method returns a `SessionClient` that you can use to communicate with the agent over time.

```ts
import { Jules } from 'julets';

const jules = Jules();

async function main() {
  const session = await jules.session({
    prompt:
      'Refactor the user authentication module. Show me your plan first.',
    source: { github: 'your-org/your-repo', branch: 'develop' },
  });

  console.log(`Session created: ${session.id}`);

  // Wait for the agent to generate a plan
  await session.waitFor('awaitingPlanApproval');
  console.log('Plan is ready for review. Approving it now.');
  await session.approve();

  // Ask a follow-up question
  const reply = await session.ask(
    'Great. Start with the first step and let me know when it is done.',
  );
  console.log(`[AGENT] ${reply.message}`);

  // Wait for the final result of the session
  const outcome = await session.result();
  console.log(`✅ Session finished with state: ${outcome.state}`);
}

main();
```

## Advanced Topics

### Working with Streams

Both `AutomatedSession` and `SessionClient` provide a `.stream()` method that returns an `AsyncIterable<Activity>`. This is the primary way to observe the agent's work in real-time.

```ts
for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'planGenerated':
      console.log('Plan:', activity.plan.steps.map((s) => s.title));
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

### Working with Artifacts

Many activities produce `artifacts`—rich objects representing outputs like code changes, shell command results, or images.

```ts
for await (const activity of session.stream()) {
  for (const artifact of activity.artifacts) {
    switch (artifact.type) {
      case 'bashOutput':
        // The .toString() helper formats the command, output, and exit code
        console.log(artifact.toString());
        break;
      case 'media':
        if (artifact.format === 'image/png') {
          // The .save() helper works in Node.js environments
          await artifact.save(`./screenshots/${activity.id}.png`);
        }
        break;
      case 'changeSet':
        console.log(artifact.gitPatch.suggestedCommitMessage);
        break;
    }
  }
}
```

### Configuration

You can configure timeouts and polling intervals when initializing the client.

```ts
const jules = Jules({
  config: {
    pollingIntervalMs: 2000, // Poll every 2 seconds
    requestTimeoutMs: 60000, // 1 minute request timeout
  },
});
```

### Error Handling

The SDK throws custom errors that all extend a base `JulesError`. This makes it easy to catch all SDK-related exceptions.

```ts
import { Jules, JulesError } from 'julets';

try {
  const outcome = await jules.run({ /* ... */ });
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

-   **Core:**
    -   `Jules()`: The main factory function to initialize the client.
    -   `jules.run()`: Starts an automated, fire-and-forget task. Returns an `AutomatedSession`.
    -   `jules.session()`: Creates or rehydrates an interactive session. Returns a `SessionClient`.
-   **Session Control:**
    -   `session.ask()`: Sends a message and awaits the agent's reply.
    -   `session.send()`: Sends a fire-and-forget message.
    -   `session.approve()`: Approves a pending plan.
    -   `session.waitFor()`: Pauses until the session reaches a specific state.
-   **Observation:**
    -   `run.stream()` / `session.stream()`: Returns an async iterator of all activities.
    -   `session.result()`: Awaits the final outcome of the session.
    -   `session.info()`: Fetches the latest session state.
-   **Utilities:**
    -   `jules.sources`: A manager to list and get available code sources.
        -   `jules.sources()`: Async iterator for all sources.
        -   `jules.sources.get({ github: '...' })`: Finds a specific GitHub repository.
