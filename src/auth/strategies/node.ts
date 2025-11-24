import * as admin from 'firebase-admin';
import { VerifyCallback, Identity } from '../../server/types.js';

export interface FirebaseAdminConfig {
  /**
   * Optional: Provide the Firebase Admin App instance. If not provided,
   * the strategy will attempt to initialize the default app.
   */
  app?: admin.app.App;
}

/**
 * Strategy: Firebase Admin SDK (Node.js Recommended)
 * Uses the official firebase-admin SDK to securely verify ID tokens.
 */
export function verifyFirebaseAdmin(
  config: FirebaseAdminConfig = {},
): VerifyCallback {
  // Initialize the Firebase app if not provided
  let firebaseApp: admin.app.App;
  try {
    firebaseApp = config.app || admin.initializeApp();
  } catch (e: any) {
    if (e.code === 'app/duplicate-app') {
      // Get the existing default app if it's already initialized
      firebaseApp = admin.app();
    } else {
      throw e;
    }
  }

  const auth = firebaseApp.auth();

  // The 'platform' argument is intentionally ignored by this Node-specific strategy
  return async (authToken: string) => {
    if (!authToken) throw new Error('Unauthorized: Auth token is missing');

    try {
      // The secure verification step
      const decodedToken = await auth.verifyIdToken(authToken);

      const identity: Identity = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      };
      return identity;
    } catch (error) {
      // Cast the error for safety and re-throw an Unauthorized error
      throw new Error(
        `Unauthorized: Invalid Firebase ID Token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
