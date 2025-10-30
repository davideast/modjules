# Jules SDK: Interactive Sessions

The interactive session mode is designed for conversational workflows where you need to collaborate with the Jules agent. This mode provides you with a `SessionClient` object, which is your primary tool for sending messages, approving plans, and streaming real-time updates from the agent.

## Creating or Resuming a Session

You can start a new interactive session or get a client for an existing one using the `jules.session()` method.

### Starting a New Session

To start a new session, provide a `SessionConfig` object. By default, new interactive sessions will require you to approve the agent's plan before it begins work.

```typescript
import { Jules } from 'julets';

const jules = Jules();

async function createNewSession() {
  const session = await jules.session({
    prompt: "Let's refactor the user authentication flow.",
    source: {
      github: 'my-org/my-repo',
      branch: 'develop'
    },
  });

  console.log(`New session created with ID: ${session.id}`);
  // Now you can use the 'session' object to interact with the agent
}
```

### Resuming an Existing Session

If you already have a session ID, you can get a `SessionClient` for it directly. This is useful for reconnecting to a session in a different part of your application or after a restart.

```typescript
const existingSessionId = 'YOUR_EXISTING_SESSION_ID';
const session = jules.session(existingSessionId);

console.log(`Resumed session with ID: ${session.id}`);
// The 'session' object is ready to be used
```

## Interacting with the SessionClient

Once you have a `SessionClient` instance, you can use its methods to interact with the session.

## Methods

### `stream(options?: StreamActivitiesOptions)`

Returns an `AsyncIterable<Activity>` that allows you to stream all activities in a session as they happen. This is the primary way to get real-time updates from a session.

**Example:**

```typescript
for await (const activity of session.stream()) {
  console.log(activity);
}
```

You can also filter the stream. For example, to only receive messages from the agent:

```typescript
for await (const activity of session.stream({
  exclude: { originator: 'user' },
})) {
  if (activity.type === 'agentMessaged') {
    console.log('Agent message:', activity.message);
  }
}
```

### `approve()`

Approves a plan that is in the `awaitingPlanApproval` state. This is only necessary if the session was created with `requirePlanApproval: true`.

**Example:**

```typescript
const sessionInfo = await session.info();
if (sessionInfo.state === 'awaitingPlanApproval') {
  await session.approve();
}
```

### `send(prompt: string)`

Sends a message to the session and does not wait for a reply. This is useful for fire-and-forget interactions where you don't need an immediate response from the agent.

**Example:**

```typescript
await session.send('Please continue.');
```

### `ask(prompt: string)`

Sends a message to the session and waits for the next message from the agent. It returns a promise that resolves with the agent's message (`ActivityAgentMessaged`). This is the most common way to have a back-and-forth conversation with the agent.

**Example:**

```typescript
const agentResponse = await session.ask('What is the next step?');
console.log('Agent response:', agentResponse.message);
```

### `send()` vs. `ask()`

-   `send()` is asynchronous. It sends a message and immediately returns, without waiting for the agent to process or respond. You would typically use `stream()` to see the agent's response and other activities.
-   `ask()` is synchronous in nature. It sends a message and blocks until the agent sends a message back, which it then returns. It's a simpler way to interact with the agent when you expect a direct reply.

Choose `send()` when you want to provide information or commands without needing an immediate answer. Choose `ask()` when you are having a conversational exchange with the agent.

### `result()`

Waits for the session to complete (either successfully or with a failure) and returns the final outcome. The `Outcome` will contain information about the final state and any artifacts produced, such as pull requests.

**Example:**

```typescript
const outcome = await session.result();
if (outcome.state === 'completed') {
  console.log('Session completed successfully.');
  if (outcome.pullRequest) {
    console.log('Pull request created:', outcome.pullRequest.url);
  }
} else {
  console.error('Session failed:', outcome.error);
}
```

### `waitFor(targetState: SessionState)`

Polls the session until it reaches a specific `SessionState` (e.g., `'inProgress'`, `'completed'`). This is useful when you need to wait for the session to reach a certain point in its lifecycle before proceeding.

**Example:**

```typescript
// Wait for the agent to start working
await session.waitFor('inProgress');
console.log('Session is now in progress.');
```

### `info()`

Retrieves the latest information about the session, including its current state, metadata, and any outputs.

**Example:**

```typescript
const sessionInfo = await session.info();
console.log('Current session state:', sessionInfo.state);
```
