# Interactive Sessions

When you need to guide, observe, or collaborate with an agent, you need an interactive session. This is for building chatbots, IDE extensions, or any workflow where a human is in the loop. `jules.session()` is the tool for this. It gives you a `SessionClient` to control the conversation.

## Example: A Full Conversation

This example shows a common interactive workflow:

1.  Start a session.
2.  Wait for the agent to generate a plan.
3.  Approve the plan.
4.  Ask a follow-up question.
5.  Wait for the final result.

```typescript
import { jules } from 'modjules';

async function collaborativeRefactor() {
  const session = await jules.session({
    prompt:
      'Refactor the user service to use the new database connection pool. First, create a plan for me to review.',
    source: { github: 'your-org/your-repo', branch: 'feature/db-pool' },
  });

  console.log(`[START] Session created: ${session.id}`);

  // It's often useful to stream all events in the background
  // so you can see what's happening.
  const streamEvents = async () => {
    for await (const activity of session.stream()) {
      if (activity.type === 'progressUpdated') {
        console.log(`[PROGRESS] ${activity.title}`);
      }
    }
  };
  streamEvents(); // Run in the background, don't await

  // 1. Wait for the agent to create the plan
  await session.waitFor('awaitingPlanApproval');
  console.log('[ACTION] Plan is ready for review.');

  // 2. Approve the plan
  await session.approve();
  console.log('[USER] Plan approved. Proceeding with execution.');

  // 3. Ask a follow-up question
  const reply = await session.ask(
    'While you work, can you tell me which files will be affected?',
  );
  console.log(`[AGENT] ${reply.message}`);

  // 4. Wait for the final outcome of the session
  const result = await session.result();
  console.log(`[END] Session finished with state: ${result.state}`);

  if (result.pullRequest) {
    console.log(`PR is available at: ${result.pullRequest.url}`);
  }
}

collaborativeRefactor();
```

## The `SessionClient`

The `jules.session()` method returns a `SessionClient`. This is your main tool for interacting with the agent. Here are the key methods:

### Controlling the Flow

- `session.approve()`: Approves a pending plan and allows the agent to start working.
- `session.waitFor(state)`: Pauses your script until the session reaches a specific state, like `'awaitingPlanApproval'` or `'completed'`.

### Communicating with the Agent

- `session.ask(message)`: Sends a message and waits for the agent's next message in response. Use this for question/answer flows.
- `session.send(message)`: Sends a "fire-and-forget" message. Your script won't wait for a reply. Use this to provide instructions or information.

### Observing the Session

- `session.stream()`: Returns an `AsyncIterator` of all activities in the session. This is the best way to get a real-time view of everything the agent is doing.
- `session.info()`: Fetches the latest snapshot of the session's state and metadata.

### Getting the Final Outcome

- `session.result()`: A promise that resolves with the final outcome of the session once it has completed or failed.

## Resuming an Existing Session

If you have a session ID, you can reconnect to it from anywhere. This is useful for building applications where the user might close a window and come back later.

```typescript
const sessionId = 'some-existing-session-id';

// This doesn't create a new session, it just gives you a client
// to control the existing one.
const session = jules.session(sessionId);

// Now you can interact with it
const info = await session.info();
console.log(`Reconnected to session. Current state: ${info.state}`);
```
