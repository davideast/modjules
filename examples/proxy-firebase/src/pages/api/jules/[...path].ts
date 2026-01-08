import type { APIRoute } from 'astro';
import { createGateway } from '@modjules/server';
import { verifyFirebaseAdmin } from '@modjules/firebase';
import { adminAuth } from '@/lib/firebase-admin';

const apiKey = import.meta.env.JULES_API_KEY;
const clientSecret = import.meta.env.JULES_CLIENT_SECRET;

const handler = createGateway({
  kind: 'session',
  apiKey,
  clientSecret,
  auth: {
    verify: verifyFirebaseAdmin({
      auth: adminAuth,
    }),
    authorize: async (user, sessionId) => {
      // Check if user is the owner
      if (user.uid === '9lfObjHWETUM3zoKWABFIPFnb4m1') {
        return { scopes: ['read', 'write', 'admin'] };
      }
      return { scopes: ['read'] };
    },
  },
});

export const POST: APIRoute = async ({ request }) => {
  return handler(request);
};

export const GET: APIRoute = async ({ request }) => {
  return handler(request);
};
