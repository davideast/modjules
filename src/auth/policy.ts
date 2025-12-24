import { AuthorizationStrategy } from '../server/types.js';
import type { Identity } from './types.js';
import type { ProtectedResource } from '../server/types.js';

export interface PolicyConfig<T extends ProtectedResource> {
  /** How to fetch the data. Returns null if not found. */
  getResource: (sessionId: string) => Promise<T | null>;

  /** Optional: List of UIDs or Emails with God Mode */
  admins?: string[];

  /** Optional: Complex logic (e.g. check team membership) */
  canAccess?: (user: Identity, resource: T) => Promise<boolean>;
}

/**
 * Factory that enforces the "Secure by Default" waterfall logic.
 */
export function createPolicy<T extends ProtectedResource>(
  config: PolicyConfig<T>,
): AuthorizationStrategy<T> {
  return async (user, sessionId) => {
    // 1. Resolve
    const resource = await config.getResource(sessionId);
    if (!resource) {
      // Security: Use generic message to prevent enumeration
      throw new Error('Access Denied: Resource not accessible.');
    }

    // 2. Admin Check (Bypass)
    if (config.admins) {
      const isUidAdmin = config.admins.includes(user.uid);
      const isEmailAdmin = user.email && config.admins.includes(user.email);
      if (isUidAdmin || isEmailAdmin) return resource;
    }

    // 3. Custom Rules (RBAC / Teams)
    if (config.canAccess) {
      const allowed = await config.canAccess(user, resource);
      if (allowed) return resource;
    }

    // 4. Default Fallback (Strict Ownership)
    if (resource.ownerId !== user.uid) {
      throw new Error('Access Denied: You do not own this session.');
    }

    return resource;
  };
}
