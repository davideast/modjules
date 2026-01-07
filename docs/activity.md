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

    case 'planApproved':
      console.log('[USER] You approved the plan.');
      break;

    case 'progressUpdated':
      console.log(`[BUSY] ${activity.title}`);
      break;

    case 'agentMessaged':
      console.log(`[AGENT] ${activity.message}`);
      break;

    case 'userMessaged':
      console.log(`[USER] ${activity.message}`);
      break;

    case 'sessionCompleted':
      console.log('✅ [DONE] Session completed successfully.');
      break;

    case 'sessionFailed':
      console.error(`❌ [FAIL] Session failed: ${activity.reason}`);
      break;
  }
}
```

## Key Activity Types

While there are many activity types, these are the most important ones for building interactive workflows.

| Activity Type        | When It Happens                                            | What It Contains                                     |
| :------------------- | :--------------------------------------------------------- | :--------------------------------------------------- |
| `planGenerated`      | The agent has created a step-by-step plan.                 | `plan`: An object with the list of steps.            |
| `planApproved`       | The user (or your code) has approved the plan.             | `planId`: The ID of the plan that was approved.      |
| `progressUpdated`    | The agent is working on a step.                            | `title`, `description`, and often `artifacts`.       |
| `agentMessaged`      | The agent sent a chat message.                             | `message`: The content of the message.               |
| `sessionCompleted`   | The task is finished successfully.                         | Often contains a `changeSet` artifact.               |
| `sessionFailed`      | The task could not be completed.                           | `reason`: An explanation of what went wrong.         |

## Common Properties

Every `Activity` object, regardless of its type, will have these properties:

-   `id`: The unique ID of the activity.
-   `type`: The string identifier for the event type.
-   `createTime`: The timestamp of when the event occurred.
-   `originator`: Who caused the event: `'user'`, `'agent'`, or `'system'`.
-   `artifacts`: An array of any artifacts associated with this activity (e.g., code changes, test results).
