# Interactive Sessions

When you need to guide, observe, or collaborate with an agent, you need an interactive session. `jules.session()` is the tool for this. It gives you a `SessionClient` to control the conversation.

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
      'Refactor the user service. First, create a plan for me to review.',
    source: { github: 'your-org/your-repo', branch: 'feature/db-pool' },
  });

  console.log(`[START] Session created: ${session.id}`);

  // 1. Wait for the agent to create the plan
  await session.waitFor('awaitingPlanApproval');
  console.log('[ACTION] Plan is ready. Approving...');

  // 2. Approve the plan
  await session.approve();
  console.log('[USER] Plan approved.');

  // 3. Ask a follow-up question
  const reply = await session.ask(
    'While you work, can you tell me which files will be affected?',
  );
  console.log(`[AGENT] ${reply.message}`);

  // 4. Wait for the final outcome
  const result = await session.result();
  console.log(`[END] Session finished with state: ${result.state}`);
}
```

---

## Reference: `SessionClient` API

The `jules.session()` method returns a `SessionClient` object. This is your main tool for interacting with the agent.

### `session.id`
- **Type**: `string`
- The unique identifier for the session.

---
### `session.approve()`
- **Signature**: `approve(): Promise<void>`
- **Description**: Approves a pending plan and allows the agent to begin executing it. This is only needed if the session was created with `requirePlanApproval: true` (the default for `jules.session()`).

---
### `session.ask()`
- **Signature**: `ask(message: string): Promise<ActivityAgentMessaged>`
- **Description**: Sends a message to the session and waits for the agent to send a message back. It returns a promise that resolves with the agent's reply.
- **Returns**: An `Activity` object of type `agentMessaged`.
  ```json
  {
    "type": "agentMessaged",
    "message": "The files affected will be user-service.ts and user-controller.ts."
  }
  ```

---
### `session.send()`
- **Signature**: `send(message: string): Promise<void>`
- **Description**: Sends a "fire-and-forget" message to the session. Your script will not wait for a reply. This is useful for providing instructions or information without needing a direct response.

---
### `session.stream()`
- **Signature**: `stream(): AsyncIterable<Activity>`
- **Description**: Returns an `AsyncIterator` that yields all activities in the session. It first streams all historical activities from the local cache and then stays open to stream live updates from the network.

---
### `session.waitFor()`
- **Signature**: `waitFor(targetState: SessionState): Promise<void>`
- **Description**: Polls the session until it reaches a specific `SessionState`.
- **`SessionState` values**: `'unspecified'`, `'creating'`, `'inProgress'`, `'awaitingPlanApproval'`, `'completed'`, `'failed'`.

---
### `session.info()`
- **Signature**: `info(): Promise<SessionResource>`
- **Description**: Fetches the latest snapshot of the session's state, metadata, and outputs from the network.
- **Returns**: A `SessionResource` object.
  ```json
  {
    "id": "12345",
    "state": "inProgress",
    "prompt": "Refactor the user service...",
    "pullRequest": null
  }
  ```

---
### `session.result()`
- **Signature**: `result(): Promise<SessionResource>`
- **Description**: Waits for the session to reach a terminal state (`completed` or `failed`) and returns the final outcome.
- **Returns**: A `SessionResource` object containing the final state and any outputs, such as a pull request.
  ```json
  {
    "id": "12345",
    "state": "completed",
    "prompt": "Refactor the user service...",
    "pullRequest": {
      "url": "https://github.com/your-org/your-repo/pull/123",
      "number": 123
    }
  }
  ```

---
## Resuming a Session
If you have a session ID, you can get a client to reconnect to it.

```typescript
const sessionId = 'some-existing-session-id';

// This doesn't create a new session, it just gives you a client
// to control the existing one.
const session = jules.session(sessionId);

const info = await session.info();
console.log(`Reconnected. Current state: ${info.state}`);
```
