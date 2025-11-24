// tests/e2e/node-proxy.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { connect } from '../../src/index.js';
import { createNodeHandler } from '../../src/node/proxy.js';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// 1. Configuration
const API_KEY = 'test-api-key';
const CLIENT_SECRET = 'test-signing-secret';
const PROXY_PASS = 'secret-password';

// 2. Mock Google API (The "Upstream")
const googleMock = setupServer(
  // Mock Creation
  http.post(
    'https://jules.googleapis.com/v1alpha/sessions',
    async ({ request }) => {
      // Verify the Proxy injected the API Key
      if (request.headers.get('x-goog-api-key') !== API_KEY) {
        return new HttpResponse(null, { status: 403 });
      }
      return HttpResponse.json({
        id: 'sess_new_123',
        name: 'sessions/sess_new_123',
      });
    },
  ),

  // Mock Resume/Info
  http.get(
    'https://jules.googleapis.com/v1alpha/sessions/:id',
    ({ params }) => {
      return HttpResponse.json({ id: params.id, state: 'inProgress' });
    },
  ),

  // Mock Source Lookup (Required for session creation)
  http.get(
    'https://jules.googleapis.com/v1alpha/sources/github/:owner/:repo',
    ({ params }) => {
      return HttpResponse.json({
        name: `sources/github/${params.owner}/${params.repo}`,
        id: 'src_123',
        githubRepo: {
          owner: params.owner,
          repo: params.repo,
          url: `https://github.com/${params.owner}/${params.repo}`,
        },
      });
    },
  ),
);

describe('E2E: Node Proxy Architecture', () => {
  let proxyServer: Server;
  let proxyUrl: string;

  beforeAll(async () => {
    // Allow localhost requests to bypass MSW (for the local proxy)
    googleMock.listen({
      onUnhandledRequest: (req) => {
        if (req.url.includes('127.0.0.1') || req.url.includes('localhost')) {
          return;
        }
        console.error('Unhandled Request:', req.method, req.url);
        throw new Error(`Unhandled Request: ${req.method} ${req.url}`);
      },
    });

    // 3. Setup The Proxy (Subject Under Test)
    const handler = createNodeHandler({
      apiKey: API_KEY,
      clientSecret: CLIENT_SECRET,
      verify: async (token) => {
        if (token === PROXY_PASS) return { uid: 'test-user' };
        throw new Error('Unauthorized');
      },
    });

    proxyServer = createServer(async (req, res) => {
      const fullUrl = new URL(req.url || '/', `http://${req.headers.host}`);

      let body: any = undefined;
      if (req.method === 'POST') {
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const data = Buffer.concat(buffers).toString();
        if (data) body = JSON.parse(data);
      }

      const response = await handler(
        new Request(fullUrl.toString(), {
          method: req.method,
          headers: req.headers as any,
          body: body ? JSON.stringify(body) : undefined,
        }),
      );

      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    });

    await new Promise<void>((resolve) => proxyServer.listen(0, resolve));
    proxyUrl = `http://localhost:${
      (proxyServer.address() as AddressInfo).port
    }`;
  });

  afterAll(() => {
    proxyServer.close();
    googleMock.close();
  });

  it('SCENARIO 1: Create a Session (Handshake Intent: Create)', async () => {
    const client = connect({
      proxy: { url: proxyUrl, auth: async () => PROXY_PASS },
    });

    // This triggers the handshake with { intent: 'create' }
    const session = await client.session({
      prompt: 'New Task',
      source: { github: 'owner/repo', branch: 'main' },
    });

    expect(session.id).toBe('sess_new_123');
  });

  it('SCENARIO 2: Resume a Session (Handshake Intent: Resume)', async () => {
    const client = connect({
      proxy: { url: proxyUrl, auth: async () => PROXY_PASS },
    });

    // Lazy initialization
    const session = client.session('sess_existing_999');

    // This triggers handshake with { intent: 'resume', sessionId: 'sess_existing_999' }
    const info = await session.info();

    expect(info.id).toBe('sess_existing_999');
    expect(info.state).toBe('inProgress');
  });

  it('SCENARIO 3: Auth Failure', async () => {
    const client = connect({
      proxy: { url: proxyUrl, auth: async () => 'WRONG_PASS' },
    });

    await expect(
      client.session({
        prompt: 'Fail',
        source: { github: 'a/b', branch: 'main' },
      }),
    ).rejects.toThrow(/Unauthorized/);
  });
});
