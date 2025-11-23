import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createNodeHandler } from 'modjules/proxy';
import 'dotenv/config';

const app = new Hono();
const PORT = 3000;

// 1. Initialize the Secure Proxy Handler
// This creates a standard Web API handler (req -> res)
const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,

  /**
   * Auth Strategy:
   * Verify the 'authToken' sent from the client (e.g., Firebase ID Token).
   * Return the user's identity to authorize the session creation.
   */
  verify: async (authToken) => {
    // SIMULATION: In a real app, verify the token with Firebase Admin SDK.
    // await getAuth().verifyIdToken(authToken);

    if (authToken === 'secret-password' || authToken.length > 0) {
      return { uid: 'user_123', email: 'demo@example.com' };
    }
    throw new Error('Invalid Auth Token');
  },
});

// 2. Configuration
app.use('/*', cors());

/**
 * 3. Mount the Handler
 * We mount the handler to /api/jules.
 * * Hono exposes the standard Fetch API Request object via `c.req.raw`.
 * Our handler processes it and returns a standard Response.
 */

app.all('/api/jules', (c) => handler(c.req.raw));

console.log(`Proxy running on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
