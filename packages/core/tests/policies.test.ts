import { describe, it, expect, vi } from 'vitest';
import { createFirestorePolicy } from '../src/auth/strategies/firestore.js';
import { createFirebasePolicy } from '../src/auth/strategies/rtdb.js';

// --- MOCKS SETUP ---

// 1. Mock Firestore
const mockFirestoreData: Record<string, any> = {};
const mockFirestore = {
  collection: (path: string) => ({
    doc: (id: string) => ({
      get: async () => {
        const data = mockFirestoreData[`${path}/${id}`];
        return {
          exists: !!data,
          data: () => data,
          id,
        };
      },
    }),
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

describe('Database Policy Helpers', () => {
  const alice = { uid: 'alice_123', email: 'alice@test.com' };
  const bob = { uid: 'bob_456' };

  describe('Firestore Policy', () => {
    // Setup Helper
    const firestorePolicy = createFirestorePolicy({
      collection: mockFirestore.collection('chats'),
      ownerField: 'author_uid', // Custom field mapping
    });

    it('successfully retrieves and authorizes owner', async () => {
      // Seed Mock
      mockFirestoreData['chats/chat_1'] = {
        author_uid: 'alice_123',
        title: 'Hello',
      };

      const { resource } = await firestorePolicy(alice, 'chat_1');

      expect(resource).toBeDefined();
      expect(resource.title).toBe('Hello');
      expect(resource.ownerId).toBe('alice_123'); // Verified normalization
    });

    it('denies access to non-owner', async () => {
      mockFirestoreData['chats/chat_1'] = { author_uid: 'alice_123' };

      await expect(firestorePolicy(bob, 'chat_1')).rejects.toThrow(
        'Access Denied',
      );
    });

    it('throws when document does not exist', async () => {
      await expect(firestorePolicy(alice, 'missing_doc')).rejects.toThrow(
        'Access Denied',
      );
    });
  });

  describe('Realtime Database (RTDB) Policy', () => {
    // Setup Helper
    const firebasePolicy = createFirebasePolicy({
      db: mockRtdb,
      rootPath: 'sessions',
      ownerField: 'userId', // Custom field mapping
      admins: ['admin@test.com'], // Add admin rule
    });

    it('successfully retrieves and authorizes owner', async () => {
      // Seed Mock
      mockFirebaseData['sessions/sess_A'] = {
        userId: 'bob_456',
        state: 'active',
      };

      const { resource } = await firebasePolicy(bob, 'sess_A');

      expect(resource).toBeDefined();
      expect(resource.state).toBe('active');
      expect(resource.ownerId).toBe('bob_456');
    });

    it('allows admin access via config', async () => {
      mockFirebaseData['sessions/sess_A'] = { userId: 'bob_456' };
      const admin = { uid: '999', email: 'admin@test.com' };

      const { resource } = await firebasePolicy(admin, 'sess_A');
      expect(resource).toBeDefined(); // Access granted despite not being owner
    });

    it('handles nested paths correctly', async () => {
      // Ensure the helper constructs 'sessions/sess_B' correctly
      mockFirebaseData['sessions/sess_B'] = { userId: 'alice_123' };

      const { resource } = await firebasePolicy(alice, 'sess_B');
      expect(resource).toBeDefined();
    });

    it('throws when data node is null/missing', async () => {
      await expect(firebasePolicy(alice, 'missing_node')).rejects.toThrow(
        'Access Denied',
      );
    });
  });
});
