import { Hono } from 'hono';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import type { SessionClient as Session } from 'modjules';
import { webcrypto } from 'node:crypto';

const uuid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : webcrypto.randomUUID();

export type McpToolHandler = (args: any) => Promise<any>;

export interface McpToolConfig {
  handler: McpToolHandler;
  /**
   * Zod shape for the tool arguments (e.g., { arg1: z.string() }).
   * Defaults to empty object if not provided.
   */
  schema?: Record<string, z.ZodTypeAny>;
}

export interface McpRemoteConfig {
  name: string;
  version: string;
  session?: () => Promise<Session>;
  tools?: Record<string, McpToolHandler | McpToolConfig>;
}

export function createMcpHandler(config: McpRemoteConfig) {
  // 1. Initialize the MCP Server
  const server = new McpServer({
    name: config.name,
    version: config.version,
  });

  // 2. Register Session as a Tool (if present)
  if (config.session) {
    server.tool('interact', { prompt: z.string() }, async ({ prompt }) => {
      const session = await config.session!();
      const activity = await session.ask(prompt);
      return { content: [{ type: 'text', text: activity.message }] };
    });
  }

  // 3. Register Custom Tools (if present)
  if (config.tools) {
    for (const [name, def] of Object.entries(config.tools)) {
      const handler = typeof def === 'function' ? def : def.handler;
      const schema = typeof def === 'function' ? {} : def.schema || {};

      server.tool(name, schema, async (args) => {
        const result = await handler(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      });
    }
  }

  // 4. Create the Hono App/Handler
  const app = new Hono();

  // Store transport instances mapped to session IDs
  const transports = new Map<string, SSEServerTransport>();

  app.get('/sse', (c) => {
    const sessionId = uuid();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Mock response object for SSEServerTransport
    const resMock = {
      writeHead: (status: number, headers: any) => {
        // Headers are set in c.body return
      },
      write: (chunk: any) => {
        const encoder = new TextEncoder();
        const data = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
        writer.write(data);
        return true;
      },
      end: () => {
        writer.close();
        transports.delete(sessionId);
      },
    };

    // The endpoint the client should POST to. We append sessionId to route it back.
    const endpointUrl = `/messages?sessionId=${sessionId}`;

    const transport = new SSEServerTransport(endpointUrl, resMock as any);
    transports.set(sessionId, transport);

    server.connect(transport).catch((e) => {
      console.error('Failed to connect transport', e);
      writer.close();
      transports.delete(sessionId);
    });

    return c.body(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });

  app.post('/messages', async (c) => {
    const sessionId = c.req.query('sessionId');
    if (!sessionId) {
      return c.text('Missing sessionId query parameter', 400);
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      return c.text('No active connection', 404);
    }

    const body = await c.req.json();
    await transport.handlePostMessage(c.req.raw as any, body);
    return c.text('Accepted', 202);
  });

  return app;
}
