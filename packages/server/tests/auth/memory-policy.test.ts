import { describe, it, expect } from 'vitest';
import { createMemoryPolicy } from '../../src/auth/strategies/memory.js';

// Mock Data
const db = {
  'session-A': { ownerId: 'alice', type: 'private' },
  'session-B': { ownerId: 'bob', type: 'public' },
};

// Setup Policy
const policy = createMemoryPolicy({
  data: db,
  admins: ['admin@test.com'],
  getScopes: async (_user: any, resource: any) => {
    // Custom Rule: Anyone can access 'public' sessions
    if (resource.type === 'public') {
      return ['read'];
    }
    return [];
  },
});

describe('Authorization Logic', () => {
  it('allows owner to access their resource', async () => {
    const { resource: result } = await policy({ uid: 'alice' }, 'session-A');
    expect(result).toBeDefined();
    expect(result.ownerId).toBe('alice');
  });

  it('blocks non-owner from private resource', async () => {
    await expect(policy({ uid: 'bob' }, 'session-A')).rejects.toThrow(
      'Access Denied',
    );
  });

  it('allows public access to public resources', async () => {
    const result = await policy({ uid: 'charlie' }, 'session-B');
    expect(result.scopes).toContain('read');
  });

  it('grants admin full access', async () => {
    const result = await policy(
      { uid: 'admin', email: 'admin@test.com' },
      'session-A',
    );
    expect(result.scopes).toEqual(['read', 'write', 'admin']);
  });

  it('throws if session not found', async () => {
    await expect(policy({ uid: 'alice' }, 'session-Z')).rejects.toThrow(
      'Access Denied',
    );
  });
});
