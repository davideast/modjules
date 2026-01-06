import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandlerCore } from '../../src/server/core.js';
import { TokenManager } from '../../src/auth/tokenizer.js';
import { mockPlatform } from '../mocks/platform.js';

describe('Security E2E', () => {
  const apiKey = 'test-api-key';
  const clientSecret = 'test-secret';
  const sessionId = 'session-123';

  // Mock Strategies
  const mockVerify = vi.fn();
  const mockAuthorize = vi.fn();

  const handler = createHandlerCore(
    {
      apiKey,
      clientSecret,
      verify: mockVerify,
      authorize: mockAuthorize,
    },
    mockPlatform,
  );

  const tokenizer = new TokenManager(mockPlatform, clientSecret);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Handshake & Scopes', () => {
    it('returns scopes in token on handshake resume', async () => {
      mockVerify.mockResolvedValue({ uid: 'user1' });
      mockAuthorize.mockResolvedValue({
        resource: {},
        scopes: ['read', 'write'],
      });

      const req = {
        method: 'POST',
        url: '/handshake',
        body: {
          intent: 'resume',
          authToken: 'valid-auth',
          sessionId,
        },
        path: '/handshake',
        headers: {},
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const claims = await tokenizer.verify(res.body.token);
      expect(claims.scope.scopes).toEqual(['read', 'write']);
    });
  });

  describe('Proxy Enforcement', () => {
    it('blocks write requests for read-only tokens', async () => {
      const token = await tokenizer.mint({
        sessionId,
        scopes: ['read'],
      });

      const req = {
        method: 'POST', // Write operation
        url: `/sessions/${sessionId}/prompt`,
        path: `/sessions/${sessionId}/prompt`,
        headers: { Authorization: `Bearer ${token}` },
        body: { message: 'hello' },
      };

      const res = await handler(req);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Write access required/);
    });

    it('allows write requests for write tokens', async () => {
      const token = await tokenizer.mint({
        sessionId,
        scopes: ['write'],
      });

      // Mock upstream fetch to return success
      vi.spyOn(mockPlatform, 'fetch').mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => JSON.stringify({ ok: true }),
      } as any);

      const req = {
        method: 'POST',
        url: `/sessions/${sessionId}/prompt`,
        path: `/sessions/${sessionId}/prompt`,
        headers: { Authorization: `Bearer ${token}` },
        body: { message: 'hello' },
      };

      const res = await handler(req);
      expect(res.status).toBe(200);
    });

    it('blocks access to wrong session', async () => {
      const token = await tokenizer.mint({
        sessionId: 'other-session',
        scopes: ['read', 'write'],
      });

      const req = {
        method: 'GET',
        url: `/sessions/${sessionId}/activities`,
        path: `/sessions/${sessionId}/activities`,
        headers: { Authorization: `Bearer ${token}` },
      };

      const res = await handler(req);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Scope violation/);
    });
  });
});
