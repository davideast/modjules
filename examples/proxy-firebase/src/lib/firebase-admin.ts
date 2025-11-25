import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK singleton.
// This relies on GOOGLE_APPLICATION_CREDENTIALS being set in the environment
// or a valid service account configuration.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log('🔥 Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
  }
}

export { admin };
