import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
// Initialize the Firebase Admin SDK singleton.
// This relies on GOOGLE_APPLICATION_CREDENTIALS being set in the environment
// or a valid service account configuration.

export const adminApp = getApps().length === 0 ? initializeApp() : getApp();
export const adminAuth = getAuth(adminApp);
