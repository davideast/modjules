# Automated Runs

Need to automate a repetitive coding task, like updating dependencies or applying a security patch? `jules.run()` is designed for exactly that. It's a "fire-and-forget" tool for your scripts and CI/CD pipelines.

## Example: Updating Dependencies

Here's how you could write a script to update all dependencies in a project and automatically create a pull request.

```typescript
import { jules } from 'modjules';

const result = await jules.run({
  prompt: 'Update all npm dependencies to their latest stable versions. Run tests to ensure nothing breaks.',
  source: {
    github: 'your-org/your-repo',
    branch: 'main',
  },
  autoPr: true, // This is true by default for jules.run()
});

if (result.state === 'completed' && result.pullRequest) {
  console.log(`✅ Success! PR created: ${result.pullRequest.url}`);
} else {
  console.error(`❌ Run failed. Check session ${result.id} for details.`);
}
```

## How It Works

`jules.run()` gives you a simple, promise-based way to execute a task.

1.  **Fire-and-Forget:** You give Jules a prompt and a source. You don't need to interact further.
2.  **Promise-based:** It returns an object that you can `await` to get the final outcome. The SDK handles all the polling and state management behind the scenes.
3.  **Automation Defaults:** It assumes you want a pull request (`autoPr: true`) and that the agent should proceed without asking for plan approval.

---

## Reference: The `AutomatedSession` Object

The `jules.run()` method returns an `AutomatedSession` object, which is an enhanced `Promise`.

### Promise Behavior

You can `await` the object directly to get the final result of the run.

`const result = await jules.run(...)`

The `result` is a `SessionResource` object with the final state of the session.

**On Success:**
```json
{
  "id": "12345",
  "state": "completed",
  "prompt": "Update all npm dependencies...",
  "pullRequest": {
    "url": "https://github.com/your-org/your-repo/pull/123",
    "number": 123,
    "branch": "jules-patch-12345"
  }
}
```

**On Failure:**
```json
{
  "id": "67890",
  "state": "failed",
  "prompt": "Update all npm dependencies...",
  "pullRequest": null,
  "error": "Failed to apply patch due to merge conflicts."
}
```

### Additional Methods

The `AutomatedSession` object also has methods for observing the run before it completes.

- **`result()`**: `() => Promise<SessionResource>`
  - This is the method that the `await` keyword calls. You can also call it directly.

- **`stream()`**: `() => AsyncIterable<Activity>`
  - Returns an async iterator to stream the session's activities in real-time. This is useful for logging progress in a CI environment.

- **`id`**: `string`
  - The session ID, which is available immediately after calling `jules.run()`.

```typescript
const automatedRun = jules.run({ prompt: '...' });

// Get the ID right away
console.log(`Run started with session ID: ${automatedRun.id}`);

// Stream progress while also waiting for the final result
const [_, result] = await Promise.all([
  (async () => {
    for await (const activity of automatedRun.stream()) {
      if (activity.type === 'progressUpdated') {
        console.log(`[LOG] ${activity.title}`);
      }
    }
  })(),
  automatedRun.result(),
]);
```
