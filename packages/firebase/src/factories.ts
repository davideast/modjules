import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase, type Database } from 'firebase-admin/database';

import {
  verifyFirebaseAdmin,
  type VerifyFirebaseAdminConfig,
} from './verify-admin.js';
import {
  createFirestorePolicy,
  type FirestorePolicyConfig,
} from './firestore.js';
import { createRTDBPolicy } from './rtdb.js';

export function getOrCreateApp(): App {
  if (getApps().length === 0) {
    return initializeApp();
  }
  return getApps()[0]; // Default app
}

export type VerifyFirebaseConfig = {
  auth?: Auth;
};

export function verifyFirebase(config: VerifyFirebaseConfig = {}) {
  let auth = config.auth;
  if (!auth) {
    const app = getOrCreateApp();
    auth = getAuth(app);
  }
  return verifyFirebaseAdmin({ auth });
}

export type AuthorizeFirestoreConfig = Omit<
  FirestorePolicyConfig,
  'collection'
> & {
  collection?: string | FirestorePolicyConfig['collection'];
  firestore?: Firestore;
};

export function authorizeFirestore(config: AuthorizeFirestoreConfig = {}) {
  const {
    collection = 'sessions',
    firestore,
    ownerField = 'ownerId',
    ...rest
  } = config;

  let collectionRef;

  if (typeof collection !== 'string') {
    // Optimization: If collection is already an object, we don't need to initialize the app/db
    collectionRef = collection;
  } else {
    // Collection is a string name (or default 'sessions')
    let db = firestore;
    if (!db) {
      const app = getOrCreateApp();
      db = getFirestore(app);
    }
    collectionRef = db.collection(collection);
  }

  return createFirestorePolicy({
    collection: collectionRef,
    ownerField,
    ...rest,
  });
}

export function authorizeRtdb(
  config: { rootPath?: string; ownerField?: string; db?: Database } & Record<
    string,
    any
  > = {},
) {
  const {
    rootPath = 'sessions',
    ownerField = 'ownerId',
    db: providedDb,
    ...rest
  } = config;

  let db = providedDb;
  if (!db) {
    const app = getOrCreateApp();
    db = getDatabase(app);
  }

  // We cast to any to satisfy the internal type requirement of createRTDBPolicy
  return createRTDBPolicy({
    db,
    rootPath,
    ownerField,
    ...rest,
  } as any);
}
