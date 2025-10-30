# Jules SDK: Automated Runs

The automated run mode is designed for tasks that can be completed by Jules without the need for intermediate human intervention. It's a "fire-and-forget" approach: you provide the instructions, and Jules works autonomously until it produces a final result.

This is the perfect mode for integrations into CI/CD pipelines, automated bug-fixing scripts, or any workflow where you want a deterministic outcome.

## Starting an Automated Run

You can start an automated run using the `jules.run()` method. It takes a `SessionConfig` object that defines the task.

```typescript
import { Jules } from 'julets';

const jules = Jules();

async function runMyTask() {
  const automatedSession = jules.run({
    prompt: "Fix the off-by-one error in the pagination logic.",
    source: {
      github: 'my-org/my-repo',
      branch: 'main'
    },
    // By default, autoPr is true, which will create a PR on completion
  });

  // ... now you can either wait for the result or stream the progress ...
}
```

## Getting the Final Result

The `AutomatedSession` object returned by `jules.run()` is an enhanced `Promise`. You can `await` it directly to get the final `Outcome` of the session, which will contain the session's final state (`completed` or `failed`) and any outputs, like a pull request.

```typescript
// ... continuing from the previous example

async function waitForResult() {
  try {
    const outcome = await automatedSession;

    console.log(`Run finished with state: ${outcome.state}`);

    if (outcome.state === 'completed' && outcome.pullRequest) {
      console.log(`Success! A pull request was created: ${outcome.pullRequest.url}`);
    } else if (outcome.state === 'failed') {
      console.error(`The run failed. Session ID: ${outcome.sessionId}`);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

waitForResult();
```

## Streaming Progress

Even though the run is automated, you might still want to see what the agent is doing in real time. The `AutomatedSession` object has a `stream()` method that returns an async iterable of all the activities in the session.

This allows you to observe the progress without interfering.

```typescript
// ... continuing from the first example

async function streamProgress() {
  console.log('Streaming progress for the automated run...');

  for await (const activity of automatedSession.stream()) {
    console.log(`[${activity.createTime}] - ${activity.type}`);

    if (activity.type === 'planGenerated') {
      console.log('Agent has generated a plan:');
      for (const step of activity.plan.steps) {
        console.log(`  - ${step.title}`);
      }
    } else if (activity.type === 'progressUpdated') {
      console.log(`Progress: ${activity.title}`);
    }
  }

  console.log('Stream finished.');
}

// You can stream progress and wait for the result simultaneously
Promise.all([
  waitForResult(),
  streamProgress(),
]);
```

By combining the promise-like nature of `AutomatedSession` with its `stream()` method, you get the best of both worlds: a simple way to get the final outcome and a powerful way to observe the real-time progress of the agent.
