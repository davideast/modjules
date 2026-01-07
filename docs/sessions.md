# Sessions

A Session is a single, stateful "job" or "conversation" with the agent. It contains all the messages, plans, code changes, and outcomes for a specific task.

There are two primary ways to start a session, depending on your use case: `jules.run()` for automated tasks and `jules.session()` for interactive workflows.

## Automated Tasks (`jules.run`)

Use `jules.run()` when you want to give the agent a task and get a final result without any back-and-forth. It's designed for automation, like a CI/CD job. You `await` it, and it returns the final state when the work is done.

This example tells the agent to update dependencies and automatically create a pull request.

```typescript
import { jules } from 'modjules';

const result = await jules.run({
  prompt: 'Upgrade all dependencies to their latest major versions.',
  source: { github: 'my-org/backend', branch: 'develop' },
  autoPr: true, // Automatically create a PR on completion
});

if (result.pullRequest) {
  console.log(`Success! PR created: ${result.pullRequest.url}`);
} else {
  console.error('Run failed or did not produce a pull request.');
}
```

## Interactive Workflows (`jules.session`)

Use `jules.session()` when you need to guide, observe, or collaborate with the agent. It returns a `SessionClient` object immediately, which you can use to send messages, approve plans, and stream real-time updates. It's perfect for building chatbots, IDE extensions, or any human-in-the-loop tool.

This example starts a session, waits for the agent to create a plan, approves it, and then waits for the final result.

```typescript
import { jules } from 'modjules';

const session = await jules.session({
  prompt: 'Help me debug the login latency issue.',
  source: { github: 'my-org/backend', branch: 'fix/login-latency' },
});

console.log(`Session started: ${session.id}`);

// The agent will generate a plan and wait for your approval
await session.waitFor('awaitingPlanApproval');
console.log('Plan is ready for review. Approving it now.');
await session.approve();

// Now you can wait for the session to complete
const outcome = await session.result();
console.log(`Session finished with state: ${outcome.state}`);
```

## `run` vs. `session`: Which to Choose?

| Use Case                                | Method              | Why                                                                   |
| :-------------------------------------- | :------------------ | :-------------------------------------------------------------------- |
| **Automated CI/CD Job**                 | `jules.run()`       | Fire-and-forget. Returns a promise that resolves with the final outcome. |
| **Batch Refactoring Script**            | `jules.run()`       | Simple `await` syntax is ideal for running many jobs in sequence or parallel. |
| **Building a Chat UI**                  | `jules.session()`   | You need the `SessionClient` to send and receive messages in real-time.    |
| **IDE Extension with Plan Approval**    | `jules.session()`   | You need to pause the agent and wait for user input (`approve()`).     |
| **Streaming Progress to a Dashboard**   | `jules.session()`   | The `session.stream()` method provides real-time activity updates.   |


## Grounding Sessions with a `Source`

Every session must be grounded in a `Source`, which tells the agent what code to work with. Currently, the only supported source is a GitHub repository and branch.

```typescript
// This tells the agent to work on the 'main' branch of 'owner/repo'
const source = {
  github: 'owner/repo',
  branch: 'main',
};
```
