import {
  createPolicy,
  type PolicyConfig,
  type ProtectedResource,
} from '@modjules/auth';
import type { Identity } from './types.js';
import type { CollectionReference } from 'firebase-admin/firestore';
import { normalizeEmailKey } from './utils.js';

export type FirestorePolicyConfig = Omit<PolicyConfig<any>, 'getResource'> & {
  collection: CollectionReference;
  ownerField?: string;
};

export function createFirestorePolicy<T extends ProtectedResource>(
  config: FirestorePolicyConfig,
) {
  const { collection, ownerField = 'ownerId', ...rules } = config;

  return createPolicy<T>({
    ...rules,
    getResource: async (sessionId) => {
      if (collection == null) throw new Error('Collection is required.');
      const doc = collection.doc(sessionId);
      const snap = await doc.get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data) return null;

      // Normalize to ProtectedResource shape
      return { ...data, ownerId: data[ownerField] } as T;
    },
  });
}

export function createFirestoreAllowList(collection: CollectionReference) {
  return async (identity: Identity): Promise<boolean> => {
    const email = identity.email;
    if (!email) return false;

    const key = normalizeEmailKey(email, 'firestore');
    const doc = await collection.doc(key).get();

    return doc.exists && doc.data()?.allowed === true;
  };
}
