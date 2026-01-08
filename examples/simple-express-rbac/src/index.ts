import express from 'express';
import { createNodeHandler } from '@modjules/server/node';
import { createRBACPolicy } from '@modjules/server/auth/rbac';

// ----------------------------------------------------------------------
// 1. Mock Data & Database
// ----------------------------------------------------------------------

interface User {
  id: string;
  email: string;
  role: 'admin' | 'viewer' | 'none';
}

interface SessionData {
  id: string;
  ownerId: string;
  title: string;
}

const USERS: Record<string, User> = {
  user_admin: { id: 'user_admin', email: 'admin@example.com', role: 'admin' },
  user_viewer: {
    id: 'user_viewer',
    email: 'viewer@example.com',
    role: 'viewer',
  },
};

const SESSIONS: Record<string, SessionData> = {
  session_123: {
    id: 'session_123',
    ownerId: 'user_admin',
    title: 'Top Secret Plan',
  },
};

// ----------------------------------------------------------------------
// 2. Configure RBAC Policy
// ----------------------------------------------------------------------

// The 'resource' type for our RBAC policy is SessionData
const rbacPolicy = createRBACPolicy<SessionData>({
  // Fetch the resource (session) from our mock DB
  getResource: async (sessionId) => {
    return SESSIONS[sessionId] || null;
  },

  // Determine the role of the user for this specific resource
  // In a real app, you might check a 'members' table or the resource's ownerId
  getRole: async (identity, sessionId, resource) => {
    // In this simple example, we trust the role stored on the User object
    // A real implementation would verify if the user actually has access to THIS session
    // e.g. if (resource.ownerId === identity.uid) return 'owner';
    const user = USERS[identity.uid];
    return user ? user.role : null;
  },

  // Define what scopes each role gets
  roles: {
    admin: ['read', 'write', 'admin'], // Full access
    viewer: ['read'], // Read-only access
  },
});

// ----------------------------------------------------------------------
// 3. Initialize Modjules Proxy Handler
// ----------------------------------------------------------------------

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY || 'mock-api-key',
  clientSecret: process.env.JULES_CLIENT_SECRET || 'mock-client-secret',

  /**
   * AUTHENTICATION (Verify Identity)
   * The client sends a Bearer token. We verify it and return the user's Identity.
   */
  verify: async (authToken) => {
    // MOCK: Check if the token matches a known user ID key
    // In production, verify a Firebase ID Token or JWT here.
    if (USERS[authToken]) {
      return { uid: USERS[authToken].id, email: USERS[authToken].email };
    }
    throw new Error('Invalid Auth Token');
  },

  /**
   * AUTHORIZATION (Check Permissions)
   * We use the RBAC policy we defined above.
   */
  authorize: rbacPolicy,
});

// ----------------------------------------------------------------------
// 4. Express Server Setup
// ----------------------------------------------------------------------

const app = express();
const PORT = 3000;

// IMPORTANT: Do NOT use express.json() for the proxy route.
// The proxy handler needs to consume the raw request stream.

app.all('/api/jules', async (req, res) => {
  try {
    // --- ADAPTER: Express (Node) -> Web Standard Request ---

    // 1. Construct the full URL
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    // 2. Convert Headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    // 3. Create Request Object
    // Express 'req' is an IncomingMessage (ReadableStream).
    // Node 18+ and Bun support passing it directly as the body.
    // However, for GET/HEAD, body must be null/undefined.
    const body =
      req.method === 'GET' || req.method === 'HEAD' ? undefined : req;

    const request = new Request(fullUrl, {
      method: req.method,
      headers: headers,
      body: body as any, // Cast to any to satisfy TS if types mismatch, but it works at runtime
      duplex: 'half', // Required for Node.js environments when sending a stream body
    } as any);

    // --- EXECUTE HANDLER ---

    const response = await handler(request);

    // --- ADAPTER: Web Standard Response -> Express (Node) ---

    // 1. Set Status
    res.status(response.status);

    // 2. Set Headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // 3. Pipe Body
    if (response.body) {
      // In Bun/Node 18, response.body is a ReadableStream.
      // We need to convert it to a Node.js stream to pipe to 'res'.
      // @ts-ignore
      const reader = response.body.getReader();

      // Simple stream reader loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Proxy Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Express RBAC Proxy listening on http://localhost:${PORT}`);
  console.log(`Try it:`);
  console.log(
    `  1. Login (Admin): curl -X POST -H "Content-Type: application/json" -d '{"intent":"create","authToken":"user_admin","context":{"source":{"type":"githubRepo","owner":"foo","repo":"bar"},"prompt":"hi"}}' http://localhost:3000/api/jules`,
  );
});
