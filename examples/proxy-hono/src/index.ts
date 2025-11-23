import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SignJWT, jwtVerify } from 'jose';
import { jules } from 'modjules'; // Admin Client (Server-Side)
import 'dotenv/config';

const app = new Hono();
const PORT = 3000;

// 1. Configuration
const JULES_API_KEY = process.env.JULES_API_KEY!;
const CLIENT_SECRET = new TextEncoder().encode(
  process.env.JULES_CLIENT_SECRET!,
);

// Enable CORS so your frontend (localhost:5173) can hit this
app.use('/*', cors());

/**
 * POST /api/jules
 * Handles BOTH "Handshake" (Auth) and "Proxy" (Data) traffic.
 *
 * The Modjules client sends:
 * - Handshake: POST /api/jules (Body: { intent, authToken })
 * - Proxy:     POST /api/jules?path=/sessions/123 (Header: Authorization)
 */
app.all('/api/jules', async (c) => {
  const url = new URL(c.req.url);
  const proxyPath = url.searchParams.get('path');

  // ---------------------------------------------------------
  // FLOW A: HANDSHAKE (Login)
  // ---------------------------------------------------------
  if (!proxyPath && c.req.method === 'POST') {
    try {
      const body = await c.req.json();
      const { intent, authToken, context } = body;

      // 1. VERIFY IDENTITY (Replace with your Auth Provider logic)
      // For this example, we accept ANY token that isn't empty.
      if (!authToken) throw new Error('Unauthorized');
      const userId = 'user_123'; // Mock User ID

      // 2. EXECUTE INTENT (Create Session)
      let sessionId: string;

      if (intent === 'create') {
        // Use the Admin SDK to create the real session on Google
        const session = await jules.run({
          prompt: context?.prompt || 'Hello',
          source: context?.source || { github: 'owner/repo', branch: 'main' },
          // Disable PRs for this demo
          autoPr: false,
        });
        sessionId = session.id;
      } else {
        // Resume: In a real app, verify 'userId' owns 'body.sessionId' DB record here.
        sessionId = body.sessionId;
      }

      // 3. MINT CAPABILITY TOKEN (JWT)
      // We sign a token that grants access ONLY to this specific sessionId
      const token = await new SignJWT({
        scope: { sessionId },
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(CLIENT_SECRET);

      return c.json({ success: true, token, sessionId });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 403);
    }
  }

  // ---------------------------------------------------------
  // FLOW B: PROXY (Traffic)
  // ---------------------------------------------------------
  if (proxyPath) {
    try {
      // 1. VERIFY CAPABILITY TOKEN
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing token' }, 401);
      }

      const token = authHeader.split(' ')[1];
      const { payload } = await jwtVerify(token, CLIENT_SECRET);
      const scope = payload.scope as { sessionId: string };

      // 2. CHECK SCOPE (Security Firewall)
      // Ensure the token matches the session being accessed
      // proxyPath looks like: "/sessions/123/activities"
      if (!proxyPath.includes(scope.sessionId)) {
        return c.json({ error: 'Scope Violation: Access Denied' }, 403);
      }

      // 3. FORWARD TO GOOGLE
      const googleUrl = `https://jules.googleapis.com/v1alpha${proxyPath}`;

      // Clone headers but strip host/auth
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('X-Goog-Api-Key', JULES_API_KEY); // Inject Real Key

      const upstream = await fetch(googleUrl, {
        method: c.req.method,
        headers,
        body:
          c.req.method !== 'GET'
            ? JSON.stringify(await c.req.json())
            : undefined,
      });

      // Return Google's response directly
      const data = await upstream.json();
      return c.json(data, upstream.status as any);
    } catch (err: any) {
      console.error(err);
      return c.json({ error: 'Proxy Error' }, 500);
    }
  }

  return c.text('Not Found', 404);
});

console.log(`Proxy running on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
