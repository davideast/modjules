# modjules Docs

A programmable SDK and MCP server for agents, IDEs, and CLIs.

```typescript
import { jules } from 'modjules';

const session = await jules.session({
  prompt: `Fix visibility issues in the examples/nextjs app.

  **Visibility issues**
  - White text on white backgrounds
  - Low contrast on button hover

  **Instructions**
  - Update the global styles and page components to a dark theme with the shadcn zinc palette.
`,
  source: { github: 'davideast/modjules', branch: 'main' },
  autoPr: true,
});

for await (const activity of session.stream()) {
  switch (activity.type) {
    case 'progressUpdated':
      console.log(`[BUSY] ${activity.title}`);
      break;
    case 'planGenerated':
      console.log(`[PLAN] ${activity.plan.steps.length} steps.`);
      break;
    case 'sessionCompleted':
      console.log('[DONE] Session finished successfully.');
      break;
    case 'sessionFailed':
      console.error(`[FAIL] ${activity.reason}`);
      break;
  }
}

// Get the pull-request URL once complete
const { pullRequest } = await session;
if (pullRequest) {
  console.log(`PR: ${pullRequest.url}`);
}
```

## Table of Contents

- **Core Concepts**
  - [Getting Started](./getting-started.md)
  - [Sessions](./sessions.md)
  - [Activities](./activity.md)
  - [Artifacts](./artifacts.md)
- **Usage Patterns**
  - [Automated Runs](./automated-runs.md)
  - [Interactive Sessions](./interactive-sessions.md)
  - [Batch Processing](./batch-processing.md)
- **Architecture**
  - [Local-First Cache](./local-first.md)
  - [Browser Usage](./browser.md)
  - [Proxy Server](./PROXY.md)
  - [Proxy Use Cases](./PROXY_USE_CASES.md)
