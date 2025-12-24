import type { APIRoute } from 'astro';
import { createFetchHandler } from 'modjules/proxy';
import { verifyFirebaseAdmin } from 'modjules/proxy/firebase';
import { adminAuth } from '@/lib/firebase-admin';

const apiKey = import.meta.env.JULES_API_KEY;
const clientSecret = import.meta.env.JULES_CLIENT_SECRET;

const handler = createFetchHandler({
  apiKey,
  clientSecret,
  verify: verifyFirebaseAdmin({
    auth: adminAuth,
  }),
  authorize: async (user, sessionId) => {
    return user.uid === '9lfObjHWETUM3zoKWABFIPFnb4m1';
  },
});

export const POST: APIRoute = async ({ request }) => {
  return handler(request);
};

export const GET: APIRoute = async ({ request }) => {
  return handler(request);
};
