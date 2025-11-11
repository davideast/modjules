# Jules SDK: Activity Types

This guide provides a detailed look at the different types of `Activity` objects you will encounter when streaming a Jules session. Each activity represents a specific event in the session's lifecycle.

## Streaming Activities

There are several ways to stream activities from a session, each suited to different use cases.

### `session.stream()` (Recommended)

The `session.stream()` method is the easiest and most common way to get a stream of activities. It's an idiomatic async iterator that provides a complete history of activities and stays open for live updates.

```typescript
for await (const activity of session.stream()) {
  console.log(`[${activity.type}]`);
}
```

This method is a convenient wrapper around the more advanced `session.activities().stream()`.

### `session.activities().stream()` (Robust)

For applications that need to be resilient to restarts, the `session.activities().stream()` method offers a more robust solution. It leverages the local-first cache to provide a hybrid stream of historical data and live updates, automatically de-duplicating events.

```typescript
const activityClient = session.activities();
for await (const activity of activityClient.stream()) {
  console.log(`[${activity.type}] ID: ${activity.id}`);
}
```

### Granular Streaming

The `ActivityClient` also provides two more granular streaming methods:

- **`.history()` (Cold Stream):** Fetches the complete activity history from the local cache and then closes the stream. This is useful for replaying or analyzing a session's past events without waiting for live updates.

  ```typescript
  const history = session.activities().history();
  for await (const activity of history) {
    // ... process historical activity
  }
  ```

- **`.updates()` (Hot Stream):** Opens a live stream of new activities from the network without fetching the history. This is ideal for situations where you only care about real-time events from the point of connection.

  ```typescript
  const updates = session.activities().updates();
  for await (const activity of updates) {
    // ... process live activity
  }
  ```

## Common Properties

All `Activity` objects share a set of common properties:

- `name`: The full resource name of the activity (e.g., `"sessions/{session}/activities/{activity}"`).
- `id`: The unique identifier for the activity.
- `createTime`: The timestamp (in RFC 3339 format) when the activity was created.
- `originator`: Who created the activity. Can be `'user'`, `'agent'`, or `'system'`.
- `artifacts`: An array of `Artifact` objects associated with the activity.

## Activity Types

The `type` property is a string that you can use to identify the kind of activity.

### `agentMessaged`

This activity occurs when the agent sends a message.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/abc",
  "id": "abc",
  "createTime": "2023-10-27T10:00:00Z",
  "originator": "agent",
  "artifacts": [],
  "type": "agentMessaged",
  "message": "I have started working on the first step of the plan."
}
```

### `userMessaged`

This activity occurs when the user sends a message to the session.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/def",
  "id": "def",
  "createTime": "2023-10-27T10:01:00Z",
  "originator": "user",
  "artifacts": [],
  "type": "userMessaged",
  "message": "Thank you, let me know if you have any questions."
}
```

### `planGenerated`

This activity occurs when the agent has formulated a plan to address the user's request.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/ghi",
  "id": "ghi",
  "createTime": "2023-10-27T10:02:00Z",
  "originator": "agent",
  "artifacts": [],
  "type": "planGenerated",
  "plan": {
    "id": "plan-1",
    "steps": [
      {
        "id": "step-1",
        "title": "Add a new component",
        "description": "I will create a new React component for the user profile page.",
        "index": 0
      },
      {
        "id": "step-2",
        "title": "Update the routing",
        "description": "I will add a new route to the application to render the new component.",
        "index": 1
      }
    ],
    "createTime": "2023-10-27T10:02:00Z"
  }
}
```

### `planApproved`

This activity occurs when a plan is approved, either automatically or by the user calling `session.approve()`.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/jkl",
  "id": "jkl",
  "createTime": "2023-10-27T10:03:00Z",
  "originator": "user",
  "artifacts": [],
  "type": "planApproved",
  "planId": "plan-1"
}
```

### `progressUpdated`

This activity provides updates on the agent's work, often including artifacts like bash output.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/mno",
  "id": "mno",
  "createTime": "2023-10-27T10:04:00Z",
  "originator": "agent",
  "artifacts": [
    {
      "type": "bashOutput",
      "command": "npm install",
      "stdout": "added 12 packages, and audited 13 packages in 1s",
      "stderr": "",
      "exitCode": 0
    }
  ],
  "type": "progressUpdated",
  "title": "Installed dependencies",
  "description": "I have successfully installed the project dependencies."
}
```

### `sessionCompleted`

This activity is the final activity in a successful session. It may contain artifacts like a `changeSet`.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/pqr",
  "id": "pqr",
  "createTime": "2023-10-27T10:05:00Z",
  "originator": "agent",
  "artifacts": [
    {
      "type": "changeSet",
      "changeSet": {
        "source": "sources/github/owner/repo",
        "gitPatch": {
          "unidiffPatch": "--- a/src/index.js\n+++ b/src/index.js\n@@ -1,1 +1,1 @@\n-console.log(\"Hello, world!\");\n+console.log(\"Hello, Jules!\");",
          "baseCommitId": "abcdef1234567890",
          "suggestedCommitMessage": "feat: Update greeting"
        }
      }
    }
  ],
  "type": "sessionCompleted"
}
```

### `sessionFailed`

This activity is the final activity in a session that has failed.

**Sample Object:**

```json
{
  "name": "sessions/123/activities/stu",
  "id": "stu",
  "createTime": "2023-10-27T10:06:00Z",
  "originator": "system",
  "artifacts": [],
  "type": "sessionFailed",
  "reason": "The agent was unable to apply the changes to the codebase."
}
```
