import { describe, it, expect } from 'vitest';
import { createMemoryPolicy } from '../src/auth/strategies/memory';

// Mock Data
const db = {
  'session-A': { ownerId: 'alice', type: 'private' },
  'session-B': { ownerId: 'bob', type: 'public' },
};

// Setup Policy
const policy = createMemoryPolicy({
  data: db,
  admins: ['admin@test.com'],
  canAccess: async (user, resource) => {
    // Custom Rule: Anyone can access 'public' sessions
    return resource.type === 'public';
  },
});

describe('Authorization Logic', () => {
  it('allows owner to access their resource', async () => {
    const result = await policy({ uid: 'alice' }, 'session-A');
    expect(result).toBeDefined();
    expect(result.ownerId).toBe('alice');
  });

  it('blocks non-owner from private resource', async () => {
    await expect(policy({ uid: 'bob' }, 'session-A')).rejects.toThrow(
      'Access Denied',
    );
  });

  it('allows non-owner to access public resource via Custom Rule', async () => {
    // Alice accessing Bob's session (Allowed because it is public)
    const result = await policy({ uid: 'alice' }, 'session-B');
    expect(result).toBeDefined();
  });

  it('allows admin to access anything', async () => {
    const result = await policy(
      { uid: 'unknown', email: 'admin@test.com' },
      'session-A',
    );
    expect(result).toBeDefined();
  });

  it('handles missing resources gracefully', async () => {
    await expect(policy({ uid: 'alice' }, 'session-missing')).rejects.toThrow(
      'Access Denied',
    );
  });
});
