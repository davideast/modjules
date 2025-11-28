import { createPolicy, PolicyConfig, ProtectedResource } from '../policy.js';

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
