# Automated Runs

`jules.run()` is a "fire-and-forget" tool for your scripts and CI/CD pipelines. It's designed for autonomous tasks where you provide a prompt, and Jules works independently to produce a final result, like a pull request.

## Example: Automated Bug Reproduction via GitHub Actions

A powerful use case for `jules.run()` is building autonomous systems. This example shows a GitHub Action that triggers whenever an issue is labeled "bug". It uses Jules to write a failing test that reproduces the bug and then creates a pull request with the new test.

This frees up developer time from writing boilerplate reproduction tests and lets them focus on the fix.

**1. The GitHub Action Workflow**

Save this file at `.github/workflows/reproduce-bug.yml`. It runs a script whenever an issue is labeled.

```yaml
name: 'Reproduce Bug'
on:
  issues:
    types: [labeled]

jobs:
  reproduce:
    if: github.event.label.name == 'bug'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Run Jules to reproduce bug
        run: npx tsx ./.github/scripts/reproduce-bug.ts
        env:
          JULES_API_KEY: ${{ secrets.JULES_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
          REPO_NWO: ${{ github.repository }}
```

**2. The Orchestration Script**

Save this file at `.github/scripts/reproduce-bug.ts`. This script formats the issue content into a prompt and calls `jules.run()`.

```typescript
import { jules } from 'modjules';

const { ISSUE_TITLE, ISSUE_BODY, REPO_NWO } = process.env;

console.log(`Attempting to reproduce bug: "${ISSUE_TITLE}"`);

const result = await jules.run({
  prompt: `
    Read the following bug report. Your goal is to write a single, new failing test case that reproduces the described bug. Do not try to fix the bug itself.

    **Bug Report Title:**
    ${ISSUE_TITLE}

    **Bug Report Body:**
    ${ISSUE_BODY}
  `,
  source: {
    github: REPO_NWO, // e.g., 'my-org/my-repo'
    branch: 'main',
  },
  autoPr: true, // Creates a PR with the new test
});

if (result.state === 'completed' && result.pullRequest) {
  console.log(
    `✅ Success! PR with failing test created: ${result.pullRequest.url}`,
  );
} else {
  console.error(`❌ Run failed. Check session ${result.id} for details.`);
}
```

## How It Works

`jules.run()` is perfect for this kind of automation because it's a simple, promise-based way to execute a task.

1.  **Fire-and-Forget:** You give Jules a prompt and a source.
2.  **Promise-based:** You can `await` the final outcome. The SDK handles all the polling and state management.
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
