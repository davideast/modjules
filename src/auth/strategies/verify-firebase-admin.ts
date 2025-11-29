import type { VerifyCallback } from '../../server/types.js';
import type { Auth } from 'firebase-admin/auth';
export interface VerifyFirebaseAdminConfig {
  auth: Auth;
}

/**
 * Strategy: Firebase Admin SDK (Node.js Recommended)
 * Uses the official firebase-admin SDK to securely verify ID tokens.
 */
export function verifyFirebaseAdmin({
  auth,
}: VerifyFirebaseAdminConfig): VerifyCallback {
  return async (authToken: string) => {
    if (!authToken) throw new Error('Unauthorized: Auth token is missing');
    try {
      return auth.verifyIdToken(authToken);
    } catch (error) {
      throw new Error(
        `Unauthorized: Invalid Firebase ID Token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
