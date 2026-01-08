# @modjules/mcp-remote

HTTP/SSE adapter for running Modjules MCP servers on remote platforms (Render, Vercel, Hono).

## User Experience

```typescript
import { Hono } from 'hono';
import { createMcpHandler } from '@modjules/mcp-remote/hono';
import { jules } from 'modjules';

const app = new Hono();

// Create the MCP handler
const mcp = createMcpHandler({
  name: 'my-agent-server',
  version: '1.0.0',
  session: async () => {
    // Return a fresh or persisted session
    // NOTE: You should likely cache this session or use a specific ID
    // to maintain context across tool calls.
    return jules.session({
        prompt: "You are a helpful assistant.",
        source: { github: "owner/repo", branch: "main" }
    });
  },
  tools: {
    // Add custom tools
    get_weather: {
        schema: { location: z.string() },
        handler: async ({ location }) => {
            return `Sunny in ${location}`;
        }
    }
  }
});

// Mount it
app.route('/mcp', mcp);

export default app;
```
