# Getting Started

This guide will get you from zero to your first running `modjules` session in a few minutes.

First, install the SDK and set your API key.

```bash
npm install modjules
export JULES_API_KEY=<your-api-key>
```

Now, create a file named `index.ts` and add the following code. This example starts a new session to refactor some code in a GitHub repository and streams the progress to your console.

```typescript
// index.ts
import { jules } from 'modjules';

async function main() {
  const session = await jules.session({
    prompt: 'Refactor the main entry point to be more modular.',
    source: { github: 'your-org/your-repo', branch: 'main' },
  });

  console.log(`[START] Session ${session.id} started.`);

  for await (const activity of session.stream()) {
    if (activity.type === 'progressUpdated') {
      console.log(`[BUSY] ${activity.title}`);
    }
    if (activity.type === 'sessionCompleted') {
      console.log('[DONE] Session finished.');
    }
  }

  const { pullRequest } = await session;
  if (pullRequest) {
    console.log(`PR available at ${pullRequest.url}`);
  }
}

main();
```

Run the script from your terminal:

```bash
npx tsx index.ts
```

You should see progress updates logged to your console as Jules works on the task.

## Two Ways to Use modjules

The SDK is designed for two main workflows: automated tasks and interactive sessions.

### Automated Runs

Use `jules.run()` for "fire-and-forget" tasks where you don't need to provide feedback. It's perfect for CI scripts, batch jobs, or other automated processes. It returns a promise that resolves with the final result.

```typescript
const result = await jules.run({
  prompt: 'Update all dependencies to their latest versions.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
  autoPr: true,
});

console.log(`Run complete. PR: ${result.pullRequest?.url}`);
```

**[Dive deeper into Automated Runs &raquo;](./automated-runs.md)**

### Interactive Sessions

Use `jules.session()` when you want to observe, guide, or interact with the agent. It returns a `SessionClient` that lets you have a conversation, approve plans, and handle complex, multi-step tasks.

```typescript
const session = await jules.session({
  prompt: 'First, show me a plan for the refactor.',
  source: { github: 'your-org/your-repo', branch: 'feature-branch' },
});

// Wait for the plan...
await session.waitFor('awaitingPlanApproval');

// ...then approve it
await session.approve();

// Now, wait for the final result
const result = await session.result();
console.log(`Session complete with state: ${result.state}`);
```

**[Dive deeper into Interactive Sessions &raquo;](./interactive-sessions.md)**
