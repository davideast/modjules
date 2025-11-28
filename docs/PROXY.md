# Jules Proxy Server

The Jules Proxy Server is a critical component for production-grade applications. It acts as a secure gateway between your client-side application (Browser, Mobile) and the Jules API.

## Core Concepts

### Purpose

The Proxy Server solves three main problems:

1.  **Security**: It hides your `JULES_API_KEY` from the client.
2.  **Identity**: It translates your application's authentication (e.g., Firebase, Auth0) into Jules sessions.
3.  **Authorization**: It enforces granular access control, ensuring User A cannot access User B's session.

### Ownership Model

Jules uses a unique "API Key is Identity" model.

- **The API Key**: Represents the "Creator" or "Root Account". It has full access to everything created under it.
- **The User**: In a multi-tenant app, your users are not IAM users in Jules. They are "Virtual Owners" managed by your proxy.

The Proxy bridges this gap. It holds the API Key (Root) but stamps every session with an `ownerId` corresponding to your user's ID.

### Security Model

The security architecture is built on three pillars:

1.  **Identity (Who are you?)**:
    The `verify` strategy authenticates the incoming request (e.g., validating a Firebase ID Token) and resolves it to a standardized `Identity` object (`{ uid, email }`).

2.  **Policy (Can you access this?)**:
    The `authorize` strategy checks if the resolved Identity has permission to access the requested Session. The default policy is "Strict Ownership" (only the owner can access), but this can be customized (e.g., for Teams or Admins).

3.  **Capabilities (The Ticket)**:
    Once verified and authorized, the Proxy mints a **Capability Token** (a signed JWT). This token is returned to the client and grants temporary, scoped access to _only_ that specific session. Subsequent requests use this token, bypassing the expensive database checks.

### Isolation

The Proxy enforces strict multi-tenancy. Even though all sessions technically belong to the same API Key, the Proxy ensures isolation logic is applied before any request reaches the Jules API.

---

## API Reference

### `createNodeHandler(config)`

Creates a generic Request/Response handler compatible with standard Web APIs (Request/Response). This works in Node.js, Next.js (App Router), Hono, Remix, and Cloudflare Workers.

```typescript
import { createNodeHandler } from 'modjules/proxy';

const handler = createNodeHandler({
  apiKey: process.env.JULES_API_KEY,
  clientSecret: process.env.JULES_CLIENT_SECRET, // Used to sign Capability Tokens
  verify: verifyFirebaseAdmin(),
  authorize: createFirebasePolicy({ ... }),
});
```

### Authentication Strategies (`verify`)

#### `verifySharedSecret(config)`

A simple strategy that checks for a static secret string. Useful for testing or server-to-server communication.

```typescript
import { verifySharedSecret } from 'modjules/auth/strategies/portable';

verify: verifySharedSecret({ secret: 'my-super-secret' });
```

#### `verifyFirebaseAdmin(config)`

**Recommended for Node.js.** Uses the official `firebase-admin` SDK to verify ID Tokens. This is the most secure and performant option for Node environments.

```typescript
import { verifyFirebaseAdmin } from 'modjules/auth/strategies/node';

verify: verifyFirebaseAdmin();
// Or with a specific app instance
// verify: verifyFirebaseAdmin({ app: myFirebaseApp })
```

#### `verifyFirebaseRest(config)`

**Portable (Edge/GAS).** Verifies ID Tokens using the Google Identity Toolkit REST API. Use this in environments where `firebase-admin` cannot run (e.g., Cloudflare Workers, Google Apps Script).

```typescript
import { verifyFirebaseRest } from 'modjules/auth/strategies/portable';

verify: verifyFirebaseRest({ apiKey: 'FIREBASE_WEB_API_KEY' });
```

### Authorization Strategies (`authorize`)

#### `createMemoryPolicy(config)`

Stores session ownership in memory. Useful for testing or ephemeral instances.

```typescript
import { createMemoryPolicy } from 'modjules/auth/strategies/memory';

const db = {}; // Shared memory object
authorize: createMemoryPolicy({
  data: db,
  // Optional: Grant 'admin-uid' access to everything
  admins: ['admin-uid'],
});
```

#### `createFirebasePolicy(config)`

Authorizes based on ownership data stored in Firebase Realtime Database.

```typescript
import { createFirebasePolicy } from 'modjules/auth/strategies/rtdb';
import { database } from 'firebase-admin';

authorize: createFirebasePolicy({
  db: database(),
  rootPath: 'sessions', // Data at /sessions/{sessionId}
  ownerField: 'ownerId', // Field containing the UID
});
```

#### `createFirestorePolicy(config)`

Authorizes based on ownership data stored in Cloud Firestore.

```typescript
import { createFirestorePolicy } from 'modjules/auth/strategies/firestore';
import { firestore } from 'firebase-admin';

authorize: createFirestorePolicy({
  db: firestore(),
  collection: 'sessions', // Collection name
  ownerField: 'author_uid', // Example of custom field name
});
```
