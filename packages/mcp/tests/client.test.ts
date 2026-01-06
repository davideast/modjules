import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JulesMCPClient } from '../src/client.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

vi.mock('@modelcontextprotocol/sdk/client/index.js');
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js');

describe('JulesMCPClient', () => {
  let client: JulesMCPClient;
  const apiKey = 'test-api-key';
  const baseUrl = 'https://jules.googleapis.com/mcp';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should instantiate correctly with config', () => {
    client = new JulesMCPClient({ apiKey });
    expect(client).toBeDefined();
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'jules-client' }),
      expect.anything(),
    );
  });

  it('should throw error if apiKey is missing', () => {
    const originalEnv = process.env.JULES_API_KEY;
    delete process.env.JULES_API_KEY;
    expect(() => new JulesMCPClient({})).toThrow(
      "JulesMCPClient requires 'apiKey'.",
    );
    process.env.JULES_API_KEY = originalEnv;
  });

  it('should use environment variable for apiKey if not provided', () => {
    process.env.JULES_API_KEY = 'env-api-key';
    client = new JulesMCPClient();
    expect(client).toBeDefined();
    // Clean up
    delete process.env.JULES_API_KEY;
  });

  it('should connect and install network interceptor', async () => {
    client = new JulesMCPClient({ apiKey });
    const mockConnect = vi.fn();
    (Client as any).mockImplementation(() => ({
      connect: mockConnect,
    }));
    // Re-instantiate to use mock
    client = new JulesMCPClient({ apiKey });

    await client.connect();

    expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
      new URL(baseUrl),
    );
    // Verify client.connect was called with the transport instance
    const transportInstance = (StreamableHTTPClientTransport as any).mock
      .instances[0];
    expect(mockConnect).toHaveBeenCalledWith(transportInstance);

    // Verify fetch interceptor
    const originalFetch = globalThis.fetch;
    expect((originalFetch as any).__julesMcpPatched).toBe(true);
  });

  it('should intercept requests and add headers', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    globalThis.fetch = mockFetch as any;
    (globalThis.fetch as any).__julesMcpPatched = false; // reset patch status

    client = new JulesMCPClient({ apiKey });
    await client.connect(); // Installs interceptor

    await fetch(`${baseUrl}/something`, { method: 'POST', body: '{}' });

    const lastCall = mockFetch.mock.calls[0];
    const url = lastCall[0];
    const init = lastCall[1];

    expect(url).toBe(`${baseUrl}/something`);
    expect(init.headers.get('X-Goog-Api-Key')).toBe(apiKey);
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('should NOT intercept non-Jules requests', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue(new Response('{}'));
    globalThis.fetch = mockFetch as any;
    (globalThis.fetch as any).__julesMcpPatched = false;

    client = new JulesMCPClient({ apiKey });
    await client.connect();

    const otherUrl = 'https://example.com/api';
    await fetch(otherUrl);

    const lastCall = mockFetch.mock.calls[0];
    expect(lastCall[0]).toBe(otherUrl);
    // Should not have our headers if we didn't add them, but headers might be undefined
    expect(lastCall[1]?.headers).toBeUndefined();
  });

  it('should call tool successfully', async () => {
    client = new JulesMCPClient({ apiKey });
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ result: 'success' }) }],
      isError: false,
    });
    const mockConnect = vi.fn();

    (Client as any).mockImplementation(() => ({
      connect: mockConnect,
      callTool: mockCallTool,
    }));
    client = new JulesMCPClient({ apiKey });

    const result = await client.callTool('test-tool', { arg: 1 });
    expect(result).toEqual({ result: 'success' });
    expect(mockCallTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test-tool', arguments: { arg: 1 } }),
      undefined,
      expect.anything(),
    );
  });

  it('should handle tool call errors', async () => {
    client = new JulesMCPClient({ apiKey });
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Something went wrong' }],
      isError: true,
    });
    const mockConnect = vi.fn();

    (Client as any).mockImplementation(() => ({
      connect: mockConnect,
      callTool: mockCallTool,
    }));
    client = new JulesMCPClient({ apiKey });

    await expect(client.callTool('fail-tool', {})).rejects.toThrow(
      'Tool Call Failed [fail-tool]: Something went wrong',
    );
  });

  it('should prioritize structuredContent', async () => {
    client = new JulesMCPClient({ apiKey });
    const structuredData = { data: 'structure' };
    const mockCallTool = vi.fn().mockResolvedValue({
      structuredContent: structuredData,
      content: [{ type: 'text', text: 'ignore me' }],
      isError: false,
    });
    const mockConnect = vi.fn();

    (Client as any).mockImplementation(() => ({
      connect: mockConnect,
      callTool: mockCallTool,
    }));
    client = new JulesMCPClient({ apiKey });

    const result = await client.callTool('struct-tool', {});
    expect(result).toEqual(structuredData);
  });
});
