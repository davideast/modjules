import { createPolicy, PolicyConfig } from '../policy.js';
import type { ProtectedResource } from '../../server/types.js';
import type { CollectionReference } from 'firebase-admin/firestore';

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
