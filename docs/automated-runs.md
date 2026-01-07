# Automated Runs

Need to automate a repetitive coding task, like updating dependencies or applying a security patch across multiple repositories? `jules.run()` is designed for exactly that. It's a "fire-and-forget" tool for your scripts and CI/CD pipelines.

## Example: Updating Dependencies

Here's how you could write a script to update all dependencies in a project and automatically create a pull request.

```typescript
import { jules } from 'modjules';

async function updateDependencies() {
  console.log('Starting automated dependency update...');

  const result = await jules.run({
    prompt: 'Update all npm dependencies to their latest stable versions. Run npm install and then run the tests to ensure nothing breaks.',
    source: {
      github: 'your-org/your-repo',
      branch: 'main',
    },
    autoPr: true, // This is true by default for jules.run()
  });

  if (result.state === 'completed' && result.pullRequest) {
    console.log(`✅ Success! PR created: ${result.pullRequest.url}`);
  } else {
    console.error(`❌ Run failed. Check session ${result.sessionId} for details.`);
  }
}

updateDependencies();
```

## How It Works

`jules.run()` gives you a simple, promise-based way to execute a task.

1.  **Fire-and-Forget:** You give Jules a prompt and a source. You don't need to interact further.
2.  **Promise-based:** It returns an object that you can `await` to get the final outcome. The SDK handles all the polling and state management behind the scenes.
3.  **Automation Defaults:** It assumes you want a pull request (`autoPr: true`) and that the agent should proceed without asking for plan approval.

This makes it the perfect tool for integrating into automated workflows.

## Observing Progress

Even in an automated run, you can still watch what's happening. The object returned by `jules.run()` also has a `.stream()` method that you can use to log progress in real-time. This is useful for long-running tasks in a CI environment.

```typescript
const automatedRun = jules.run({
  prompt: 'Refactor the entire API surface to be async/await.',
  source: { github: 'your-org/your-repo', branch: 'develop' },
  autoPr: true,
});

// You can observe the stream and await the result at the same time
const [_, result] = await Promise.all([
  (async () => {
    for await (const activity of automatedRun.stream()) {
      if (activity.type === 'progressUpdated') {
        console.log(`[LOG] ${activity.title}`);
      }
    }
  })(),
  automatedRun.result(), // Wait for the final outcome
]);

console.log(`Run finished with state: ${result.state}`);
```
