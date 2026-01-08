# Proxy Server Recipes

This guide provides a set of practical, copy-and-paste examples for common proxy server configurations.

## Recipe 1: Next.js with Firebase

This is a robust, production-ready setup for a Next.js application using Firebase for authentication and Firestore for authorization.

**1. Create the Route Handler**

Create a file at `app/api/jules/[...proxy]/route.ts`. The `[...proxy]` part is a catch-all route that will forward all requests under `/api/jules` to the handler.

```typescript
// app/api/jules/[...proxy]/route.ts
import { createNodeHandler } from '@modjules/server';
import { verifyFirebaseAdmin } from '@modjules/server/auth/firebase-admin';
import { createFirestorePolicy } from '@modjules/server/auth/firestore';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (ensures it only runs once)
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)),
  });
}

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,
  verify: verifyFirebaseAdmin(),
  authorize: createFirestorePolicy({
    db: getFirestore(),
    collection: 'sessions', // Your Firestore collection
    ownerField: 'ownerId', // The field containing the user's UID
  }),
});

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

**2. Configure the Client**

On the client-side, configure `modjules` to point to your new API route.

```typescript
// src/lib/jules.ts
import { jules } from 'modjules/browser';
import { getAuth } from 'firebase/auth';

export const userJules = jules.with({
  proxy: {
    url: '/api/jules', // Points to the route handler
    getAuthToken: async () => {
      const user = getAuth().currentUser;
      return user ? user.getIdToken() : null;
    },
  },
});
```

## Recipe 2: Hono (Cloudflare Workers) with Custom Auth

This example shows how to use the proxy with a non-Node.js runtime like Cloudflare Workers (via the Hono framework) and a custom authentication provider (e.g., Auth0, Supabase).

```typescript
// index.ts (in your Hono app)
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createNodeHandler } from '@modjules/server';
import { createMemoryPolicy } from '@modjules/server/auth/memory';

const app = new Hono().basePath('/api');

const julesProxy = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,

  // Implement your own logic to verify the user's token
  verify: async (token) => {
    const response = await fetch('https://my-auth-provider.com/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Invalid auth token');
    }
    const user = await response.json();
    return { uid: user.sub, email: user.email }; // Must return this shape
  },

  // Use an in-memory database for authorization (for simplicity)
  authorize: createMemoryPolicy({ data: {} }),
});

// Forward all requests to the handler
app.all('/jules/*', (c) => julesProxy(c.req.raw));

export default handle(app);
```

## Recipe 3: Express.js with Simple Shared Secret

This is the simplest possible proxy, useful for server-to-server communication or internal tools where you can securely share a secret key.

```typescript
// server.ts
import express from 'express';
import { createNodeHandler } from '@modjules/server';
import { verifySharedSecret } from '@modjules/server/auth/shared-secret';
import { createMemoryPolicy } from '@modjules/server/auth/memory';

const app = express();

const julesProxy = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,
  verify: verifySharedSecret({ secret: process.env.MY_SHARED_SECRET! }),
  authorize: createMemoryPolicy({ data: {} }), // Everyone can access everything
});

app.all('/jules/*', julesProxy);

app.listen(3001);
```

To use this, the client must send the secret in the `Authorization` header.

```typescript
import { jules } from 'modjules/browser';

const internalJules = jules.with({
  proxy: {
    url: 'http://localhost:3001/jules',
    getAuthToken: () => process.env.MY_SHARED_SECRET,
  },
});
```
