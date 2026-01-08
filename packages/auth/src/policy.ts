import type {
  AuthorizationStrategy,
  Scope,
  Identity,
  ProtectedResource,
} from './types.js';

export interface PolicyConfig<T extends ProtectedResource> {
  /** How to fetch the data. Returns null if not found. */
  getResource: (sessionId: string) => Promise<T | null>;

  /** Optional: List of UIDs or Emails with God Mode */
  admins?: string[];

  /** Optional: Custom logic to determine scopes (e.g. check team membership) */
  getScopes?: (user: Identity, resource: T) => Promise<Scope[]>;
}

/**
 * Factory that enforces the "Secure by Default" waterfall logic.
 */
export function createPolicy<T extends ProtectedResource>(
  config: PolicyConfig<T>,
): AuthorizationStrategy {
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
      if (isUidAdmin || isEmailAdmin) {
        return { resource, scopes: ['read', 'write', 'admin'] };
      }
    }

    // 3. Custom Rules (RBAC / Teams)
    if (config.getScopes) {
      const scopes = await config.getScopes(user, resource);
      if (scopes && scopes.length > 0) {
        return { resource, scopes };
      }
    }

    // 4. Default Fallback (Strict Ownership)
    if (resource.ownerId !== user.uid) {
      throw new Error('Access Denied: You do not own this session.');
    }

    return { resource, scopes: ['read', 'write', 'admin'] };
  };
}
