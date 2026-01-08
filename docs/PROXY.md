# Secure Proxy Server

For any production browser application, you must use a secure proxy server to protect your `JULES_API_KEY` and manage user sessions. The `@modjules/server` package provides a handler to make this easy.

The proxy is a backend service you run that sits between your frontend application and the Jules API. It solves three key problems:

1.  **Security**: It keeps your API key safe on the server, never exposing it to the browser.
2.  **Authentication**: It connects with your existing authentication system (e.g., Firebase Auth, Auth0) to identify users.
3.  **Authorization**: It ensures users can only access their own sessions.

## Example: An Express.js Proxy

This example shows how to create a secure proxy using Express.js and Firebase Authentication.

```typescript
// server.ts
import express from 'express';
import { createNodeHandler } from '@modjules/server';
import { verifyFirebaseAdmin } from '@modjules/server/auth/firebase-admin';
import { createFirestorePolicy } from '@modjules/server/auth/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert(require('./service-account.json')),
});

const app = express();

// Create the Jules proxy handler
const julesProxy = createNodeHandler({
  // Core Jules API credentials
  apiKey: process.env.JULES_API_KEY,
  clientSecret: process.env.JULES_CLIENT_SECRET, // A secret for signing user tokens

  // Your app's authentication strategy
  verify: verifyFirebaseAdmin(),

  // Your app's authorization strategy
  authorize: createFirestorePolicy({
    db: getFirestore(),
    collection: 'sessions', // The Firestore collection where you store session ownership
    ownerField: 'userId', // The field on the document that stores the user's ID
  }),
});

// All requests to `/jules` will be handled by the proxy
app.all('/jules/*', julesProxy);

app.listen(3001, () => {
  console.log('Proxy server listening on port 3001');
});
```

On the client, you configure the SDK to use the proxy URL. It will automatically handle authentication and token management.

```typescript
// client.ts
import { jules } from 'modjules/browser';
import { getAuth, signInWithCustomToken, getIdToken } from 'firebase/auth';

const auth = getAuth();
// ... sign in the user ...

// Configure the SDK to talk to your proxy
const userJules = jules.with({
  proxy: {
    url: 'http://localhost:3001/jules',
    // The SDK will call this function to get the user's auth token
    getAuthToken: () => getIdToken(auth.currentUser),
  },
});

// Now you can use the SDK as normal, and all requests will be
// securely routed through your proxy.
const session = await userJules.session({ prompt: 'Hello!' });
```

## Security Model

The proxy uses a three-step process to secure every request:

1.  **Verify (Authentication)**: The `verify` function checks the user's identity. In the example above, `verifyFirebaseAdmin` validates the Firebase ID token sent from the client.

2.  **Authorize (Authorization)**: The `authorize` function checks if the identified user has permission to access the requested session. `createFirestorePolicy` does this by looking up the session ID in your Firestore database and ensuring the `userId` field matches the user's ID.

3.  **Mint Capability Token**: If both checks pass, the proxy mints a short-lived **Capability Token** (a JWT). This token grants the user temporary, specific access to a single session. This token is sent back to the client, which then uses it to make direct, authorized requests for that session.

This ensures that even if a user managed to get another user's session ID, the proxy would deny them access.
