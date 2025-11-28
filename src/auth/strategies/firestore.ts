import { Firestore } from 'firebase-admin/firestore';
import { createPolicy, PolicyConfig, ProtectedResource } from '../policy.js';

type FirestorePolicyConfig = Omit<PolicyConfig<any>, 'getResource'> & {
  db: Firestore;
  collection: string;
  ownerField?: string; // e.g., 'userId' or 'author_uid'
};

export function createFirestorePolicy<T extends ProtectedResource>(
  config: FirestorePolicyConfig,
) {
  const { db, collection, ownerField = 'ownerId', ...rules } = config;

  return createPolicy<T>({
    ...rules,
    getResource: async (id) => {
      const snap = await db.collection(collection).doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data) return null;

      // Normalize to ProtectedResource shape
      return { ...data, ownerId: data[ownerField] } as T;
    },
  });
}
