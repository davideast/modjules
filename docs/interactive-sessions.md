# Interactive Sessions

`jules.session()` is for building conversational, human-in-the-loop systems. It gives you a `SessionClient` object to control the agent, approve its plans, and have a back-and-forth conversation. This is the tool you need for building things like chatbots, IDE extensions, or custom internal tools.

## Example: A "ChatOps" Slack Bot for Production Alerts

This example shows how you could build a Slack bot that uses Jules to respond to a production alert. When an alert fires, the bot starts a Jules session to investigate the cause. It then posts the agent's plan to a Slack channel and waits for an on-call engineer to approve it before the agent attempts a fix.

This demonstrates a powerful orchestration pattern: an automated system kicks off the process, but a human has the final say on the most critical step.

```typescript
// src/slack-bot.ts
import { jules } from 'modjules';
import { slack, awaitSlackApproval } from './slack-api'; // Fictional Slack API library

// This function is triggered by a webhook from your monitoring service (e.g., DataDog)
async function handleProductionAlert(alert) {
  const { serviceName, errorMessage, traceId } = alert;

  await slack.postMessage(
    '#prod-alerts',
    `🚨 Alert on ${serviceName}: ${errorMessage}`,
  );

  // 1. Start an interactive session to investigate the alert
  const session = await jules.session({
    prompt: `
      We just received a production alert in the '${serviceName}' service.
      Error message: "${errorMessage}"
      Trace ID: ${traceId}

      Your task is to investigate the root cause of this alert.
      Start by analyzing the service logs around the time of the alert.
      Then, formulate a plan to either fix the issue or roll back the change that caused it.
      Do not execute the plan until it is approved.
    `,
    source: { github: `my-org/${serviceName}`, branch: 'main' },
  });

  await slack.postMessage(
    '#prod-alerts',
    `Jules is investigating... (Session: ${session.id})`,
  );

  // 2. Wait for the agent to generate a plan
  await session.waitFor('awaitingPlanApproval');
  const { plan } = await session.info();

  // 3. Post the plan to Slack and wait for a human to approve it
  const isApproved = await awaitSlackApproval(
    '#prod-alerts',
    `Jules has a plan to fix the alert. Please review and approve:`,
    plan.steps,
  );

  if (isApproved) {
    // 4. If approved, tell the agent to proceed
    await session.approve();
    await slack.postMessage(
      '#prod-alerts',
      'Plan approved by engineer. Jules is attempting the fix.',
    );

    const result = await session.result();
    if (result.state === 'completed' && result.pullRequest) {
      await slack.postMessage(
        '#prod-alerts',
        `✅ Fix complete! PR is ready for review: ${result.pullRequest.url}`,
      );
    } else {
      await slack.postMessage(
        '#prod-alerts',
        `❌ Jules failed to fix the issue. Please investigate manually.`,
      );
    }
  } else {
    await slack.postMessage('#prod-alerts', 'Plan rejected. Aborting session.');
  }
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
