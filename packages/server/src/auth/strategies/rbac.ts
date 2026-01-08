import { AuthorizationStrategy, Scope, Identity } from '@modjules/auth';

export interface RBACConfig<T> {
  /** Fetch the resource (session) itself */
  getResource: (sessionId: string) => Promise<T | null>;
  /** Determine the user's role for this resource */
  getRole: (
    user: Identity,
    sessionId: string,
    resource: T,
  ) => Promise<string | null>;
  /** Map roles to scopes */
  roles: Record<string, Scope[]>;
}

export function createRBACPolicy<T>(
  config: RBACConfig<T>,
): AuthorizationStrategy {
  return async (user: Identity, sessionId: string) => {
    // 1. Fetch Resource
    const resource = await config.getResource(sessionId);
    if (!resource) throw new Error('Session not found');

    // 2. Determine Role
    const roleName = await config.getRole(user, sessionId, resource);

    // 3. Check Permissions
    if (!roleName || !config.roles[roleName]) {
      throw new Error('Access Denied: No role assigned for this session.');
    }

    // 4. Return Resource + Scopes
    return {
      resource,
      scopes: config.roles[roleName],
    };
  };
}
