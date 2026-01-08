import {
  createPolicy,
  type PolicyConfig,
  type ProtectedResource,
  type VerifyCallback,
  type Identity,
} from '@modjules/auth';

type MemoryPolicyConfig<T extends ProtectedResource> = Omit<
  PolicyConfig<T>,
  'getResource'
> & {
  data: Record<string, T>;
};

export function createMemoryPolicy<T extends ProtectedResource>(
  config: MemoryPolicyConfig<T>,
) {
  const { data, ...rules } = config;
  return createPolicy<T>({
    ...rules,
    getResource: async (id) => {
      const item = data[id];
      // Clone to simulate network/db separation
      return item ? JSON.parse(JSON.stringify(item)) : null;
    },
  });
}

/**
 * Strategy: Shared Secret
 * Simple equality check. Retained for testing/internal tools.
 */
export function verifySharedSecret(config: { secret: string }): VerifyCallback {
  return async (token: string) => {
    if (!config.secret)
      throw new Error("Strategy Config Error: 'secret' is missing");
    if (token === config.secret) {
      return { uid: 'admin_user' } as Identity; // Return Identity object
    }
    throw new Error('Unauthorized: Invalid Secret');
  };
}
