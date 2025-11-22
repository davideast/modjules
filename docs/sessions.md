# Sessions

A **Session** is the fundamental unit of work in modjules. It represents a stateful, enduring interaction between an AI agent and a specific context (your code).

Think of a Session as a "job" or a "conversation" with the agent. It has a lifecycle (created, running, paused, completed/failed), a history of activities (messages, plans, tool uses), and an outcome (like a Pull Request).

## Sessions and Sources

A Session cannot exist in a vacuum. It must be grounded in a **Source**.

A **Source** defines the _context_ in which the agent operates. Currently, the primary source type is a **GitHub Repository**. When you start a session, you are telling the agent: _"Do this task, inside this repository, starting from this branch."_

The relationship is 1-to-1 for a specific run:

- **One Session** belongs to **One Source Context**.
- The agent reads code from that source.
- The agent proposes changes (via Git patches) to that source.

```typescript
// Defines the context: "Work on the 'main' branch of 'owner/repo'"
const source = {
  github: 'owner/repo',
  branch: 'main',
};
```

## Creating a Session: `run()` vs `session()`

modjules provides two distinct ways to start a session, optimized for different paradigms: **Automation** and **Interaction**.

While both methods technically create a session API resource, they return different client objects and set different default behaviors to match their intended use cases.

| Feature              | `jules.run()`                      | `jules.session()`                     |
| :------------------- | :--------------------------------- | :------------------------------------ |
| **Paradigm**         | **Automation** (Fire-and-Forget)   | **Interactive** (Human-in-the-Loop)   |
| **Return Type**      | `AutomatedSession` (Promise-like)  | `SessionClient` (Object)              |
| **Auto-PR**          | **Yes** (Defaults to `true`)       | **Unspecified** (Defaults to `false`) |
| **Plan Approval**    | **Skipped** (Defaults to `false`)  | **Required** (Defaults to `true`)     |
| **Primary Use Case** | CI/CD, Cron Jobs, Batch Processing | Chat Apps, IDE Plugins, CLI Tools     |

### 1. `jules.run()`: The Automation Mode

Use `jules.run()` when you want to give the agent a task and walk away. This is the "Async/Await" of agent interactions. It is designed for headless environments where no human is watching the process in real-time.

**Why use it?**

- **Simplicity:** It abstracts away the complexity of polling and state management.
- **CI/CD Integration:** Perfect for triggering agents from GitHub Actions or other pipelines.
- **Batch Processing:** Run 50 refactoring tasks in parallel using `jules.all()`.

**Behavior:**

- It automatically assumes you want a Pull Request at the end.
- It assumes you trust the agent to execute the plan without manual approval (unless configured otherwise).
- The returned object allows you to simply `await` the final result.

```typescript
import { jules } from 'modjules';

// AUTOMATION EXAMPLE
// "Here is a task, call me when it's done."
const run = await jules.run({
  prompt: 'Upgrade all dependencies to their latest major versions',
  source: { github: 'my-org/backend', branch: 'develop' },
  // Defaults:
  // - autoPr: true (Will create a PR when finished)
  // - requireApproval: false (Will execute immediately)
});

console.log(`Job started: ${run.id}`);

// You can await the result directly.
// modjules handles polling and completion checking for you.
const outcome = await run.result();

if (outcome.pullRequest) {
  console.log(`Success! PR created: ${outcome.pullRequest.url}`);
}
```

### 2. `jules.session()`: The Interactive Mode

Use `jules.session()` when you are building an experience where a user interacts with the agent. This is for building Chatbots, IDE extensions, or internal tools where a human is guiding the process.

**Why use it?**

- **Control:** You need fine-grained control over the conversation flow (e.g., `ask()`, `send()`, `approve()`).
- **Observability:** You want to stream activities to a UI as they happen.
- **Safety:** Defaults to requiring human approval before code changes are applied.

**Behavior:**

- It returns a `SessionClient` that lets you send messages back and forth.
- It defaults to `requireApproval: true`, meaning the agent will pause after planning and wait for you to call `session.approve()`.

```typescript
import { jules } from 'modjules';

// INTERACTIVE EXAMPLE
// "Let's collaborate on this task together."
const session = await jules.session({
  prompt: 'Help me debug the login latency issue',
  source: { github: 'my-org/backend', branch: 'develop' },
  // Defaults:
  // - autoPr: false (Wait for instructions)
  // - requireApproval: true (Pause for human review)
});

// The activity stream is an infinite async iterable.
// We run it in the background so we can continue interacting with the session.
async function monitorSession() {
  for await (const activity of session.stream()) {
    console.log(`[${activity.type}]: ${activity.message || ''}`);

    // Handle Plan Approval automatically in this example loop
    if (activity.type === 'planGenerated') {
      console.log('Plan generated. Approving...');
      await session.approve();
    }
  }
}

// Start background monitoring
monitorSession();

// Send more info or ask questions dynamically while the stream runs in the background.
await session.send('Check the redis configuration specifically.');

// Wait for a specific answer
const reply = await session.ask('What did you find in the redis logs?');
console.log('Agent replied:', reply.message);

// Wait for the session to finish
const outcome = await session.result();
console.log(`Session completed with status: ${outcome.state}`);
```
