# modjules Docs

A programmable SDK and MCP server for agents, IDEs, and CLIs.

```typescript
import { jules } from 'modjules';

const session = await jules.session({
  prompt: `Fix visibility issues in the examples/nextjs app.`,
  source: { github: 'davideast/modjules', branch: 'main' },
  autoPr: true,
});

for await (const activity of session.stream()) {
  if (activity.type === 'progressUpdated') {
    console.log(`[BUSY] ${activity.title}`);
  }
}
```

## Table of Contents

- **SDK: Core Concepts**
  - [Getting Started](./getting-started.md)
  - [Sessions](./sessions.md)
  - [Activities](./activity.md)
  - [Artifacts](./artifacts.md)
- **SDK: Usage Patterns**
  - [Automated Runs](./automated-runs.md)
  - [Interactive Sessions](./interactive-sessions.md)
  - [Batch Processing](./batch-processing.md)
- **MCP Server**
  - [Configuration](./mcp-configuration.md)
  - [Practical Use Cases](./mcp-use-cases.md)
  - [Client Integrations](./mcp-integrations.md)
  - [Composing Servers](./mcp-composing-servers.md)
  - [Tool Reference](./mcp-tool-reference.md)
- **Advanced**
  - [Local-First Cache](./local-first.md)
  - [Browser Usage](./browser.md)
  - [Secure Proxy Server](./PROXY.md)
