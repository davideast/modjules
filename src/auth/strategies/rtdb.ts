import { Database } from 'firebase-admin/database';
import { createPolicy, PolicyConfig, ProtectedResource } from '../policy.js';

type FirebasePolicyConfig = Omit<PolicyConfig<any>, 'getResource'> & {
  db: Database;
  /**
   * The root path where resources are stored.
   * Example: 'sessions' -> checks 'sessions/{sessionId}'
   */
  rootPath: string;
  /**
   * The key in the object that holds the owner's UID.
   * Defaults to 'ownerId'.
   */
  ownerField?: string;
};

export function createFirebasePolicy<T extends ProtectedResource>(
  config: FirebasePolicyConfig,
) {
  const { db, rootPath, ownerField = 'ownerId', ...rules } = config;

  return createPolicy<T>({
    ...rules,
    getResource: async (sessionId: string) => {
      // Construct path safely ensuring single slash
      const cleanRoot = rootPath.replace(/\/$/, '');
      const ref = db.ref(`${cleanRoot}/${sessionId}`);

      const snapshot = await ref.get();

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.val();
      if (!data) return null;

      // Normalize to ProtectedResource shape
      // We explicitly map the configured ownerField to 'ownerId'
      return {
        ...data,
        ownerId: data[ownerField],
      } as T;
    },
  });
}
