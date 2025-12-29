import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createGateway } from 'modjules/server';
import 'dotenv/config';

const app = new Hono();
const PORT = 3000;

// 1. Initialize the Session Gateway
// This creates a standard Web API handler (req -> res)
const handler = createGateway({
  kind: 'session',
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,

  auth: {
    /**
     * Verify Strategy:
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

    /**
     * Authorize Strategy:
     * Determine what scopes the user has for this session.
     */
    authorize: async (user, sessionId) => {
      // In a real app, check database for user's permissions on this session
      return { scopes: ['read', 'write'] };
    },
  },
});

// 2. Configuration
app.use('/*', cors());

/**
 * 3. Mount the Handler
 * We mount the handler to /api/jules.
 * Hono exposes the standard Fetch API Request object via `c.req.raw`.
 * Our handler processes it and returns a standard Response.
 */

app.all('/api/jules', (c) => handler(c.req.raw));

console.log(`Gateway running on http://localhost:${PORT}`);
serve({ fetch: app.fetch, port: PORT });
