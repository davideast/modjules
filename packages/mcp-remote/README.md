# @modjules/mcp-remote

This package provides an HTTP/SSE adapter for running Modjules MCP (Model Context Protocol) servers on various remote platforms like Vercel, Render, or any environment that supports [Hono](https://hono.dev/).

It allows you to expose Modjules tools and sessions securely over the web, enabling rich, interactive experiences in your applications.

## Installation

```bash
npm install @modjules/mcp-remote hono
```

## Usage

The primary export is `createMcpHandler`, a factory function that creates a Hono application handler. You can use this handler directly with platforms that support Hono, or integrate it into an existing Hono application.

### Basic Example

Here's a simple example of how to create an MCP server and expose it using Hono.

```typescript
// src/index.ts
import { Hono } from 'hono';
import { createMcpHandler } from '@modjules/mcp-remote';

const app = new Hono();

const mcpHandler = createMcpHandler({
  name: 'my-remote-server',
  version: '1.0.0',
  tools: {
    // A simple tool that adds two numbers
    add: {
      schema: {
        a: z.number(),
        b: z.number(),
      },
      handler: async ({ a, b }) => {
        return a + b;
      },
    },
    // A tool with no arguments
    hello: async () => {
      return { message: 'Hello, world!' };
    },
  },
});

// Mount the MCP handler
app.route('/mcp', mcpHandler);

export default app;
```

### Integrating with Modjules Sessions

You can connect your remote MCP server to a Modjules session to create powerful, stateful agents.

```typescript
import { Hono } from 'hono';
import { createMcpHandler } from '@modjules/mcp-remote';
import { jules } from 'modjules';

const app = new Hono();

const mcpHandler = createMcpHandler({
  name: 'my-agent-server',
  version: '1.0.0',
  // Provide a function that returns a Modjules session
  session: async () => {
    return jules.session(); // Creates a new session
  },
});

app.route('/mcp', mcpHandler);

export default app;
```

When a `session` provider is configured, the handler automatically exposes an `interact` tool that allows clients to send prompts to the session.

## API

### `createMcpHandler(config)`

Creates a Hono application instance that handles MCP requests.

**`config`**: `McpRemoteConfig`

An object with the following properties:

- `name` (string, required): The name of your MCP server.
- `version` (string, required): The version of your server.
- `session` (() => Promise<Session>, optional): An async function that returns a Modjules `SessionClient` instance. If provided, enables the built-in `interact` tool.
- `tools` (Record<string, McpToolHandler | McpToolConfig>, optional): An object where keys are tool names and values define the tool's implementation.

**Tool Configuration**

A tool can be defined as a simple async handler function or as a configuration object:

- `handler` (McpToolHandler, required): The async function that executes the tool's logic. It receives the tool arguments as an object.
- `schema` (Record<string, z.ZodTypeAny>, optional): A Zod schema definition for validating the tool's input arguments. If not provided, no validation is performed.
