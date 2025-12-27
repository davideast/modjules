import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerCore } from '../../src/server/core.js';
import { ServerConfig } from '../../src/server/types.js';
import { NodePlatform } from '../../src/platform/node.js';

describe('Server Core Handler', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any; // For ApiClient usage inside core

  const platform = new NodePlatform();
  const mockPlatformFetch = vi.fn();
  platform.fetch = mockPlatformFetch; // For Proxy flow

  const config: ServerConfig = {
    apiKey: 'test-api-key',
    clientSecret: 'test-secret',
    verify: async (token) => {
      if (token === 'valid-token') return { uid: 'user-1' };
      throw new Error('Invalid Token');
    },
    authorize: async (user, sessionId) => {
      if (sessionId === 'allowed-session') {
        return {
          scopes: ['read', 'write'],
          resource: { id: sessionId },
        };
      }
      throw new Error('Unauthorized');
    },
  };

  const handler = createHandlerCore(config, platform);
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();

    const mockFetchImpl = async (url: string, opts: any) => {
      if (url.includes('google.com')) {
        return {
          status: 200,
          json: async () => ({ data: 'proxy-response' }),
        };
      }
      // Mock create session response
      if (url.includes('/sessions') && opts.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'new-session-id' }),
        };
      }
      return { status: 404, json: async () => ({}) };
    };

    // Mock platform.fetch (used by Proxy flow)
    (platform.fetch as any).mockImplementation(mockFetchImpl);

    // Mock global.fetch (used by ApiClient in Handshake flow)
    global.fetch = vi.fn().mockImplementation(mockFetchImpl as any) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('Handshake: Creates session and returns token', async () => {
    const res = await handler({
      method: 'POST',
      body: {
        intent: 'create',
        authToken: 'valid-token',
        context: {
          prompt: 'test',
          source: { type: 'githubRepo', owner: 'o', repo: 'r' },
        },
      },
      headers: {},
      path: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBe('new-session-id');
    expect(res.body.token).toBeDefined();

    // Verify session creation called with ownerId
    const createCall = (global.fetch as any).mock.calls.find((c: any) =>
      c[0].includes('/sessions'),
    );
    const body = JSON.parse(createCall[1].body);
    expect(body.ownerId).toBe('user-1');
  });

  it('Handshake: Resumes session if authorized', async () => {
    const res = await handler({
      method: 'POST',
      body: {
        intent: 'resume',
        authToken: 'valid-token',
        sessionId: 'allowed-session',
      },
      headers: {},
      path: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBe('allowed-session');
  });

  it('Handshake: Fails resume if unauthorized', async () => {
    const res = await handler({
      method: 'POST',
      body: {
        intent: 'resume',
        authToken: 'valid-token',
        sessionId: 'forbidden-session',
      },
      headers: {},
      path: '',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Proxy: Forwards allowed request with API Key', async () => {
    // 1. Get a valid token first
    const handshake = await handler({
      method: 'POST',
      body: {
        intent: 'resume',
        authToken: 'valid-token',
        sessionId: 'allowed-session',
      },
      headers: {},
      path: '',
    });
    const token = handshake.body.token;

    // 2. Make proxy request
    const res = await handler({
      method: 'GET',
      path: '/sessions/allowed-session/activities',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: 'proxy-response' });

    // Verify upstream call
    expect(mockPlatformFetch).toHaveBeenCalledWith(
      expect.stringContaining('google.com'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
        }),
      }),
    );
  });

  it('Proxy: Blocks request to different session (Scope Guard)', async () => {
    const handshake = await handler({
      method: 'POST',
      body: {
        intent: 'resume',
        authToken: 'valid-token',
        sessionId: 'allowed-session',
      },
      headers: {},
      path: '',
    });
    const token = handshake.body.token;

    const res = await handler({
      method: 'GET',
      path: '/sessions/other-session/activities', // Mismatch!
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Scope violation/);
  });
});
