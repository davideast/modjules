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
