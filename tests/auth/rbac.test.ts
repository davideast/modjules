import { describe, it, expect, vi } from 'vitest';
import { createRBACPolicy } from '../../src/auth/strategies/rbac.js';
import { Scope } from '../../src/server/types.js';

describe('RBAC Policy', () => {
  const roles: Record<string, Scope[]> = {
    viewer: ['read'],
    editor: ['read', 'write'],
    admin: ['read', 'write', 'admin'],
  };

  const mockGetResource = vi.fn();
  const mockGetRole = vi.fn();

  const policy = createRBACPolicy({
    getResource: mockGetResource,
    getRole: mockGetRole,
    roles,
  });

  const user = { uid: 'user1' };
  const sessionId = 'session1';
  const resource = { id: sessionId, ownerId: 'owner1' };

  it('returns viewer scopes', async () => {
    mockGetResource.mockResolvedValue(resource);
    mockGetRole.mockResolvedValue('viewer');

    const result = await policy(user, sessionId);
    expect(result.scopes).toEqual(['read']);
    expect(result.resource).toBe(resource);
  });

  it('returns admin scopes', async () => {
    mockGetResource.mockResolvedValue(resource);
    mockGetRole.mockResolvedValue('admin');

    const result = await policy(user, sessionId);
    expect(result.scopes).toEqual(['read', 'write', 'admin']);
  });

  it('throws if no role assigned', async () => {
    mockGetResource.mockResolvedValue(resource);
    mockGetRole.mockResolvedValue(null);

    await expect(policy(user, sessionId)).rejects.toThrow('Access Denied');
  });

  it('throws if session not found', async () => {
    mockGetResource.mockResolvedValue(null);

    await expect(policy(user, sessionId)).rejects.toThrow('Session not found');
  });
});
