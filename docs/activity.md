# Understanding Activities

Every event that happens in a session is recorded as an `Activity`. When you use `session.stream()`, you get a real-time feed of these activities. By inspecting an activity's `type`, you can understand what the agent is doing and build responsive, interactive applications.

## Example: Building a Status Log

The most common way to use the activity stream is to build a real-time log of the agent's progress. A `switch` statement on the `activity.type` is a great way to handle this.

```typescript
import { jules } from 'modjules';

const session = jules.session('some-session-id');

for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'planGenerated':
      console.log('[PLAN] The agent has a new plan:');
      for (const step of activity.plan.steps) {
        console.log(`  - ${step.title}`);
      }
      break;
    // ... other cases
  }
}
```

## Key Activity Types

| Activity Type        | When It Happens                                            | What It Contains                                     |
| :------------------- | :--------------------------------------------------------- | :--------------------------------------------------- |
| `planGenerated`      | The agent has created a step-by-step plan.                 | `plan`: An object with the list of steps.            |
| `progressUpdated`    | The agent is working on a step.                            | `title`, `description`, and often `artifacts`.       |
| `agentMessaged`      | The agent sent a chat message.                             | `message`: The content of the message.               |
| `sessionCompleted`   | The task is finished successfully.                         | Often contains a `changeSet` artifact.               |
| `sessionFailed`      | The task could not be completed.                           | `reason`: An explanation of what went wrong.         |

---

## Reference: Activity Shapes

Below are the detailed shapes of the most common activity types. All activities share these **common properties**:

- `id`: The unique ID of the activity.
- `type`: The string identifier for the event type.
- `createTime`: The timestamp of when the event occurred.
- `originator`: Who caused the event: `'user'`, `'agent'`, or `'system'`.
- `artifacts`: An array of any artifacts associated with this activity.

### `planGenerated`

Occurs when the agent formulates a plan. Your application may need to call `session.approve()` before the agent will proceed.

```json
{
  "id": "ghi",
  "type": "planGenerated",
  "createTime": "2023-10-27T10:02:00Z",
  "originator": "agent",
  "artifacts": [],
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
    ]
  }
}
```

### `progressUpdated`

Provides updates on the agent's work, often including artifacts like test results or file changes.

```json
{
  "id": "mno",
  "type": "progressUpdated",
  "createTime": "2023-10-27T10:04:00Z",
  "originator": "agent",
  "title": "Installed dependencies",
  "description": "I have successfully installed the project dependencies.",
  "artifacts": [
    {
      "type": "bashOutput",
      "command": "npm install",
      "stdout": "added 12 packages, and audited 13 packages in 1s",
      "stderr": "",
      "exitCode": 0
    }
  ]
}
```

### `agentMessaged`

Occurs when the agent sends a message in the conversation.

```json
{
  "id": "abc",
  "type": "agentMessaged",
  "createTime": "2023-10-27T10:00:00Z",
  "originator": "agent",
  "message": "I have started working on the first step of the plan.",
  "artifacts": []
}
```

### `sessionCompleted`

The final activity in a successful session. It frequently contains a `changeSet` artifact with the final code changes.

```json
{
  "id": "pqr",
  "type": "sessionCompleted",
  "createTime": "2023-10-27T10:05:00Z",
  "originator": "agent",
  "artifacts": [
    {
      "type": "changeSet",
      "changeSet": {
        "source": "sources/github/owner/repo",
        "gitPatch": {
          "unidiffPatch": "--- a/src/index.js\n+++ b/src/index.js\n...",
          "baseCommitId": "abcdef1234567890",
          "suggestedCommitMessage": "feat: Update greeting"
        }
      }
    }
  ]
}
```

### `sessionFailed`

The final activity in a session that could not be completed.

```json
{
  "id": "stu",
  "type": "sessionFailed",
  "createTime": "2023-10-27T10:06:00Z",
  "originator": "system",
  "reason": "The agent was unable to apply the changes to the codebase.",
  "artifacts": []
}
```
