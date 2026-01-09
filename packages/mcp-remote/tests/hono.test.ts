import { describe, it, expect, vi } from 'vitest';
import { createMcpHandler } from '../src/hono.js';
import { Hono } from 'hono';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    constructor() {}
    tool() {}
    connect() { return Promise.resolve(); }
  }
}));

vi.mock('@modelcontextprotocol/sdk/server/sse.js', () => ({
  SSEServerTransport: class {
    constructor(endpoint: string, res: any) {
        // We can assert on endpoint here if needed
    }
    handlePostMessage() { return Promise.resolve(); }
  }
}));

describe('createMcpHandler', () => {
  it('should create a Hono app', () => {
    const handler = createMcpHandler({
      name: 'test',
      version: '1.0.0'
    });
    expect(handler).toBeInstanceOf(Hono);
  });

  it('should register custom tools', () => {
    // This is a basic smoke test since we mocked McpServer
    const handler = createMcpHandler({
      name: 'test',
      version: '1.0.0',
      tools: {
        testTool: async () => 'result'
      }
    });
    expect(handler).toBeDefined();
  });
});
