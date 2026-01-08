import {
  createPolicy,
  type PolicyConfig,
  type ProtectedResource,
} from '@modjules/auth';
import type { Identity } from './types.js';
import { type Database } from 'firebase-admin/database';
import { normalizeEmailKey } from './utils.js';

type RTDBPolicyConfig = Omit<PolicyConfig<any>, 'getResource'> & {
  db: Database;
  rootPath: string;
  /**
   * The key in the object that holds the owner's UID.
   * Defaults to 'ownerId'.
   */
  ownerField?: string;
};

export function createRTDBPolicy<T extends ProtectedResource>(
  config: RTDBPolicyConfig,
) {
  const { db, rootPath, ownerField = 'ownerId', ...rules } = config;

  return createPolicy<T>({
    ...rules,
    getResource: async (sessionId: string) => {
      if (!rootPath) return null;
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

export function createRTDBAllowList(db: Database, path: string = 'allowlist') {
  return async (identity: Identity): Promise<boolean> => {
    const email = identity.email;
    if (!email) return false;

    const key = normalizeEmailKey(email, 'rtdb');
    const snapshot = await db.ref(`${path}/${key}`).get();

    // Checks if value is strictly true
    return snapshot.exists() && snapshot.val() === true;
  };
}
