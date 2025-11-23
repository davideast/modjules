import { describe, it, expect, vi } from 'vitest';
import { createNodeHandler } from '../../src/node/proxy.js';

// Mock the dependencies to isolate the Adapter logic
const mockCoreHandler = vi.fn();

vi.mock('../../src/server/core.js', () => ({
  createHandlerCore: () => mockCoreHandler,
}));

describe('Node Proxy Adapter', () => {
  const config = {
    apiKey: 'key',
    clientSecret: 'secret',
    verify: async () => 'user',
  };

  it('parses JSON body and passes it to core', async () => {
    mockCoreHandler.mockResolvedValue({ status: 200, body: { success: true } });

    const handler = createNodeHandler(config);
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ intent: 'create', foo: 'bar' }),
    });

    const res = await handler(req);

    // Check if Core was called with adapted data
    expect(mockCoreHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { intent: 'create', foo: 'bar' },
      }),
    );

    // Check output adaptation
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('extracts "path" query parameter for proxying', async () => {
    mockCoreHandler.mockResolvedValue({ status: 200, body: {} });

    const handler = createNodeHandler(config);
    // Simulate client requesting: GET /api?path=/sessions/123
    const req = new Request('http://localhost/api?path=/sessions/123');

    await handler(req);

    expect(mockCoreHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/sessions/123',
      }),
    );
  });

  it('handles malformed JSON bodies gracefully', async () => {
    mockCoreHandler.mockResolvedValue({
      status: 400,
      body: { error: 'Bad Request' },
    });

    const handler = createNodeHandler(config);
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: 'invalid-json',
    });

    // Should not throw, just pass empty body or fail gracefully
    await handler(req);

    expect(mockCoreHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        body: undefined, // Malformed JSON results in no body
      }),
    );
  });
});
