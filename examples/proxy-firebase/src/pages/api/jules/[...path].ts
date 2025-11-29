import type { APIRoute } from 'astro';
import { createFetchHandler } from 'modjules/proxy';
import { verifyFirebaseAdmin } from 'modjules/proxy/firebase';
import { createMemoryPolicy } from 'modjules/proxy/memory';
import { adminAuth } from '@/lib/firebase-admin'; // Ensure Admin SDK is initialized

const apiKey = import.meta.env.JULES_API_KEY;
const clientSecret = import.meta.env.JULES_CLIENT_SECRET;

debugger;

// 1. Configure the Proxy Handler
// We use 'createFetchHandler' because Astro endpoints receive standard Request objects.
const handler = createFetchHandler({
  apiKey,
  clientSecret,
  // Enforces server-side token verification
  verify: verifyFirebaseAdmin({
    auth: adminAuth,
  }),
  authorize: async (user, sessionId) => {
    console.log(user, sessionId);
    // In a real app, fetch session metadata from Firestore here.
    // Return the resource to verify ownership (resource.ownerId === user.uid).
    return { ownerId: user.uid, id: sessionId };
  },
});

// 2. Define the POST Route
// This intercepts all POST requests to /api/jules/* and passes them to modjules
export const POST: APIRoute = async ({ request }) => {
  console.log('POST', request);
  return handler(request);
};

// 3. Optional: Health Check for GET requests
// This intercepts all GET requests to /api/jules/* and passes them to modjules
export const GET: APIRoute = async ({ request }) => {
  console.log('GET', request);
  return handler(request);
};

// export const ALL: APIRoute = async ({ request }) => {
//   return handler(request);
// };
