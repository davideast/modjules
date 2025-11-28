import type { APIRoute } from 'astro';
import { createFetchHandler } from 'modjules/proxy/web';
import { verifyFirebaseAdmin } from 'modjules/proxy/strategies/node';
import '@/lib/firebase-admin'; // Ensure Admin SDK is initialized

// 1. Configure the Proxy Handler
// We use 'createFetchHandler' because Astro endpoints receive standard Request objects.
const handler = createFetchHandler({
  apiKey: import.meta.env.JULES_API_KEY,
  clientSecret: import.meta.env.JULES_CLIENT_SECRET,
  verify: verifyFirebaseAdmin(), // Enforces server-side token verification
  authorize: async (user, sessionId) => {
    // In a real app, fetch session metadata from Firestore here.
    // Return the resource to verify ownership (resource.ownerId === user.uid).
    return { ownerId: user.uid, id: sessionId };
  },
});

// 2. Define the POST Route
// This intercepts all POST requests to /api/jules/* and passes them to modjules
export const POST: APIRoute = async ({ request }) => {
  return handler(request);
};

// 3. Optional: Health Check for GET requests
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'online',
      service: 'modjules-proxy',
      strategy: 'firebase-admin',
    }),
    { status: 200 },
  );
};
