import { describe, it, expect, vi } from 'vitest';
import { createFirestorePolicy } from '../../src/auth/strategies/firestore.js';
import { createFirebasePolicy } from '../../src/auth/strategies/rtdb.js';

// --- MOCKS SETUP ---

// 1. Mock Firestore
const mockFirestoreData: Record<string, any> = {};
const mockCollection = {
  doc: (id: string) => ({
    get: async () => {
      const data = mockFirestoreData[id];
      return {
        exists: !!data,
        data: () => data,
        id,
      };
    },
  }),
} as any;

// 2. Mock Realtime Database
const mockFirebaseData: Record<string, any> = {};
const mockRtdb = {
  ref: (path: string) => ({
    get: async () => {
      const data = mockFirebaseData[path];
      return {
        exists: () => !!data,
        val: () => data,
      };
    },
  }),
} as any;

// --- TESTS ---

describe('createFirestorePolicy', () => {
  const policy = createFirestorePolicy({ collection: mockCollection });

  it('allows the owner full access', async () => {
    mockFirestoreData['session-123'] = { ownerId: 'user-abc' };

    const result = await policy({ uid: 'user-abc' }, 'session-123');

    expect(result.resource.ownerId).toBe('user-abc');
    // Owner gets all scopes
    expect(result.scopes).toEqual(['read', 'write', 'admin']);
  });

  it('blocks access for non-owners', async () => {
    mockFirestoreData['session-123'] = { ownerId: 'user-abc' };

    await expect(
      policy({ uid: 'attacker-xyz' }, 'session-123'),
    ).rejects.toThrow('Access Denied');
  });

  it('throws if session not found', async () => {
    await expect(
      policy({ uid: 'user-abc' }, 'no-such-session'),
    ).rejects.toThrow('Access Denied');
  });
});

describe('createFirebasePolicy', () => {
  const policy = createFirebasePolicy({
    db: mockRtdb,
    rootPath: 'jules_sessions',
  });

  it('allows the owner full access', async () => {
    mockFirebaseData['jules_sessions/session-456'] = { ownerId: 'user-xyz' };

    const result = await policy({ uid: 'user-xyz' }, 'session-456');

    expect(result.resource.ownerId).toBe('user-xyz');
    expect(result.scopes).toEqual(['read', 'write', 'admin']);
  });

  it('blocks access for non-owners', async () => {
    mockFirebaseData['jules_sessions/session-456'] = { ownerId: 'user-xyz' };

    await expect(policy({ uid: 'hacker-001' }, 'session-456')).rejects.toThrow(
      'Access Denied',
    );
  });
});
