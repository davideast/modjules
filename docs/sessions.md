# Sessions

A Session is a single, stateful "job" or "conversation" with the agent. It contains all the messages, plans, code changes, and outcomes for a specific task.

There are two primary ways to start a session, depending on your use case: `jules.run()` for automated tasks and `jules.session()` for interactive workflows.

## Automated Tasks (`jules.run`)

Use `jules.run()` when you want to give the agent a task and get a final result without any back-and-forth. It's designed for automation, like a CI/CD job. You `await` it, and it returns the final state when the work is done.

```typescript
import { jules } from 'modjules';

const result = await jules.run({
  prompt: 'Upgrade all dependencies to their latest major versions.',
  source: { github: 'my-org/backend', branch: 'develop' },
  // Defaults for jules.run():
  // autoPr: true (Will create a PR when finished)
  // requirePlanApproval: false (Will execute immediately)
});
```

### When to use `jules.run`

- **Simplicity:** It abstracts away the complexity of polling and state management into a single `await`.
- **CI/CD Integration:** Perfect for triggering agents from GitHub Actions or other pipelines.
- **Batch Processing:** The simple, promise-based return value is ideal for use with `jules.all()`.

## Interactive Workflows (`jules.session`)

Use `jules.session()` when you need to guide, observe, or collaborate with the agent. It returns a `SessionClient` object immediately, which you can use to send messages, approve plans, and stream real-time updates.

```typescript
import { jules } from 'modjules';

const session = await jules.session({
  prompt: 'Help me debug the login latency issue.',
  source: { github: 'my-org/backend', branch: 'fix/login-latency' },
  // Defaults for jules.session():
  // autoPr: false (Waits for instructions)
  // requirePlanApproval: true (Pauses for human review)
});

console.log(`Session started: ${session.id}`);

// The agent will generate a plan and wait for your approval
await session.waitFor('awaitingPlanApproval');
await session.approve();

const outcome = await session.result();
console.log(`Session finished with state: ${outcome.state}`);
```

### When to use `jules.session`

- **Control:** When you need fine-grained control over the conversation flow (e.g., `ask()`, `send()`, `approve()`).
- **Observability:** When you want to stream activities to a UI or log as they happen.
- **Safety:** It defaults to requiring human approval before code changes are applied.

## `run` vs. `session`: Which to Choose?

| Use Case                              | Method            | Why                                                                           |
| :------------------------------------ | :---------------- | :---------------------------------------------------------------------------- |
| **Automated CI/CD Job**               | `jules.run()`     | Fire-and-forget. Returns a promise that resolves with the final outcome.      |
| **Batch Refactoring Script**          | `jules.run()`     | Simple `await` syntax is ideal for running many jobs in sequence or parallel. |
| **Building a Chat UI**                | `jules.session()` | You need the `SessionClient` to send and receive messages in real-time.       |
| **IDE Extension with Plan Approval**  | `jules.session()` | You need to pause the agent and wait for user input (`approve()`).            |
| **Streaming Progress to a Dashboard** | `jules.session()` | The `session.stream()` method provides real-time activity updates.            |

## Repoless Sessions

Both `jules.run()` and `jules.session()` support **repoless sessions** - sessions created without a GitHub repository. These are useful for general coding tasks, code review, or learning.

```typescript
import { jules, parseUnidiff } from 'modjules';

// Create a repoless session - no source required
const session = await jules.run({
  prompt: `Create a TypeScript user service with:
  - User interface with id, name, email
  - fetchUserData async function using fetch API
  - processUsers batch function using Promise.allSettled
  
  Make sure to handle errors gracefully.`,
  // No source property - this creates a repoless session
});

// Access the generated code from session outputs
const info = await session.info();
for (const output of info.outputs) {
  // Check for changeSet output (note: 'type' field may be missing from API)
  if ('changeSet' in output) {
    const patch = output.changeSet.gitPatch.unidiffPatch;

    // Use parseUnidiff to get file metadata
    const files = parseUnidiff(patch);
    console.log(`Generated ${files.length} files:`);
    for (const file of files) {
      console.log(`  ${file.path} (+${file.additions}/-${file.deletions})`);
    }

    // Access the suggested commit message
    console.log(`Commit: ${output.changeSet.gitPatch.suggestedCommitMessage}`);
  }
}
```

### When to use Repoless Sessions

| Use Case                     | Why Repoless                                           |
| :--------------------------- | :----------------------------------------------------- |
| **Learning & Exploration**   | Ask Jules to explain concepts or generate example code |
| **Code Review Assistance**   | Paste code in your prompt and ask for feedback         |
| **Quick Prototypes**         | Generate scaffolding or boilerplate without a repo     |
| **Architecture Discussions** | Discuss design patterns and get code examples          |

### Retrieving Generated Code

Repoless sessions return a `changeSet` in `session.outputs` instead of a `pullRequest`. Use the `parseUnidiff` utility to parse the unified diff:

```typescript
import { parseUnidiff } from 'modjules';

// Parse generates structured file information
const files = parseUnidiff(output.changeSet.gitPatch.unidiffPatch);

// Each file has: path, changeType, additions, deletions
for (const file of files) {
  console.log(`[${file.changeType}] ${file.path}`);
}
```
