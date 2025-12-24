# Jules Proxy: Use Cases & Examples

This guide provides practical examples of how to configure the Jules Proxy for various scenarios.

## 1. Client-Side Access with Node Proxy & Modjules Client

This is the standard setup for a Next.js application.

**Server-Side (Next.js Route Handler - `app/api/jules/route.ts`)**

```typescript
import { createNodeHandler } from 'modjules/proxy';
import { verifyFirebaseAdmin } from 'modjules/auth/strategies/node';
import { createFirebasePolicy } from 'modjules/auth/strategies/rtdb';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,
  verify: verifyFirebaseAdmin(),
  authorize: createFirebasePolicy({
    db: admin.database(),
    rootPath: 'sessions',
  }),
});

export { handler as GET, handler as POST };
```

**Client-Side (React Component)**

```typescript
import { jules } from 'modjules/browser';
import { getAuth } from 'firebase/auth';

// 1. Configure the client to point to your proxy
const client = jules.connect({
  proxy: {
    url: '/api/jules',
    // 2. Provide the auth token on demand
    auth: async () => {
      const user = getAuth().currentUser;
      return user ? user.getIdToken() : null;
    }
  }
});

// 3. Use the client as normal
const session = await client.session({
  source: { ... },
  prompt: "Help me write code"
});
```

## 2. Verifying Tokens Without Helpers

You can write your own verification logic if you are using a provider other than Firebase (e.g., Auth0, Supabase).

```typescript
import { createNodeHandler } from 'modjules/proxy';

const handler = createNodeHandler({
  // ... keys ...
  verify: async (token, platform) => {
    // Custom verification logic
    const response = await fetch('https://my-auth-provider.com/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Invalid Token');

    const user = await response.json();
    return {
      uid: user.sub,
      email: user.email,
    };
  },
  // ... authorize ...
});
```

## 3. Setting Authorization Policies Without Helpers

You can implement custom authorization logic, for example, to query a SQL database or check complex permissions.

```typescript
import { createNodeHandler } from 'modjules/proxy';

const handler = createNodeHandler({
  // ... keys ...
  // ... verify ...
  authorize: async (user, sessionId) => {
    // 1. Fetch the resource metadata from your DB
    const sessionRecord = await mySqlDb.query(
      'SELECT owner_id, team_id FROM sessions WHERE id = ?',
      [sessionId],
    );

    if (!sessionRecord) {
      throw new Error('Session not found');
    }

    // 2. Check Ownership
    if (sessionRecord.owner_id === user.uid) {
      return sessionRecord;
    }

    // 3. Check Team Access (Example custom rule)
    const userTeam = await getUserTeam(user.uid);
    if (sessionRecord.team_id === userTeam.id) {
      return sessionRecord;
    }

    throw new Error('Access Denied');
  },
});
```

## 4. Setting Authorization Policies with Memory Policy

Ideal for local development or testing where you don't want to spin up a database.

```typescript
import { createNodeHandler } from 'modjules/proxy';
import { createMemoryPolicy } from 'modjules/auth/strategies/memory';

// A simple in-memory store
const sessionStore = {};

const handler = createNodeHandler({
  // ...
  authorize: createMemoryPolicy({
    data: sessionStore,
    admins: ['admin-user-id'], // Optional: Allow this user to access all sessions
  }),
});
```

## 5. End-to-End: Firebase Admin & Realtime Database

This is a robust, production-ready configuration.

**Scenario**: You have a Next.js app using Firebase Auth. You want to store session metadata in Firebase Realtime Database to ensure that users can only access sessions they created.

**Implementation**:

```typescript
// app/api/jules/route.ts
import { createNodeHandler } from 'modjules/proxy';
import { verifyFirebaseAdmin } from 'modjules/auth/strategies/node';
import { createFirebasePolicy } from 'modjules/auth/strategies/rtdb';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Singleton pattern)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,

  // 1. Verify: Decode Firebase ID Token
  verify: verifyFirebaseAdmin(),

  // 2. Authorize: Check ownership in RTDB
  // Checks path: /user_sessions/{sessionId}
  // Expects data: { ownerId: "uid123", ... }
  authorize: createFirebasePolicy({
    db: admin.database(),
    rootPath: 'user_sessions',
    ownerField: 'ownerId',
  }),
});

export { handler as GET, handler as POST };
```

## 6. Firestore Database Authorization

Similar to the RTDB example, but using Cloud Firestore.

```typescript
// app/api/jules/route.ts
import { createNodeHandler } from 'modjules/proxy';
import { verifyFirebaseAdmin } from 'modjules/auth/strategies/node';
import { createFirestorePolicy } from 'modjules/auth/strategies/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY!,
  clientSecret: process.env.JULES_CLIENT_SECRET!,
  verify: verifyFirebaseAdmin(),

  // Authorize using Firestore
  // Checks document: sessions/{sessionId}
  authorize: createFirestorePolicy({
    db: admin.firestore(),
    collection: 'sessions',
    ownerField: 'userId', // Matches the field in your Firestore document
  }),
});

export { handler as GET, handler as POST };
```
