import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHandlerCore } from '../../src/server/core';
import { NodePlatform } from '../../src/platform/node';

describe('Server Core (The Vendor)', () => {
  const platform = new NodePlatform();

  // Mock the platform's network layer
  platform.fetch = vi.fn();

  const config = {
    apiKey: 'GOOG_KEY',
    clientSecret: 'SERVER_SECRET',
    verify: vi.fn().mockResolvedValue({ uid: 'user_1' }),
    authorize: async (user: any, sessionId: string) => ({
      ownerId: user.uid,
      id: sessionId,
    }),
  };

  const handler = createHandlerCore(config, platform);

  // Mock implementation for fetch
  const mockFetchImpl = async (url: string, init: any) => {
    if (url.includes('/sources/github/owner/repo')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: 'sources/github/owner/repo',
          id: 'src_123',
          githubRepo: { owner: 'owner', repo: 'repo' },
        }),
        text: async () =>
          JSON.stringify({
            name: 'sources/github/owner/repo',
            id: 'src_123',
            githubRepo: { owner: 'owner', repo: 'repo' },
          }),
      };
    }
    if (url.includes('/sessions')) {
      // Check if it's creating a session or fetching one
      if (init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'sess_123',
            name: 'sessions/sess_123',
            state: 'inProgress',
            createTime: new Date().toISOString(),
          }),
          text: async () =>
            JSON.stringify({
              id: 'sess_123',
              name: 'sessions/sess_123',
              state: 'inProgress',
              createTime: new Date().toISOString(),
            }),
        };
      }
      // Proxy request or other GETs
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: 'proxy_success' }),
        text: async () => JSON.stringify({ data: 'proxy_success' }),
      };
    }
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Not Found',
      json: async () => ({}),
    };
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock platform.fetch (used by Proxy flow)
    (platform.fetch as any).mockImplementation(mockFetchImpl);

    // Mock global.fetch (used by ApiClient in Handshake flow)
    global.fetch = vi.fn().mockImplementation(mockFetchImpl as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('Handshake: Creates session and returns token', async () => {
    const res = await handler({
      method: 'POST',
      path: '/',
      headers: {},
      body: {
        intent: 'create',
        authToken: 'valid_firebase_token',
        context: {
          prompt: 'hi',
          source: { github: 'owner/repo', branch: 'main' },
        },
      },
    });

    if (res.status !== 200) {
      console.error('Handshake failed:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBe('sess_123');
    expect(typeof res.body.token).toBe('string');
  });

  it('Proxy: Forwards request if token is valid', async () => {
    // 1. Get a valid token first
    const handshake = await handler({
      method: 'POST',
      path: '/',
      headers: {},
      body: {
        intent: 'create',
        authToken: 'valid',
        context: {
          prompt: 'hi',
          source: { github: 'owner/repo', branch: 'main' },
        },
      },
    });
    const token = handshake.body.token;

    // 2. Use token to access the SPECIFIC session
    const res = await handler({
      method: 'GET',
      path: '/sessions/sess_123/activities',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    // Verify upstream call
    expect(platform.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sessions/sess_123/activities'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'GOOG_KEY' }),
      }),
    );
  });

  it('Proxy: Blocks access to wrong session (Scope Violation)', async () => {
    // Token is for sess_123
    const handshake = await handler({
      method: 'POST',
      path: '/',
      headers: {},
      body: {
        intent: 'create',
        authToken: 'valid',
        context: {
          prompt: 'hi',
          source: { github: 'owner/repo', branch: 'main' },
        },
      },
    });
    const token = handshake.body.token;

    // Try to access sess_999
    const res = await handler({
      method: 'GET',
      path: '/sessions/sess_999/activities',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Scope violation/);
  });
});
