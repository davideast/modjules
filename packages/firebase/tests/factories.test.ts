import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as adminApp from 'firebase-admin/app';
import * as adminFirestore from 'firebase-admin/firestore';
import * as adminAuth from 'firebase-admin/auth';
import * as adminDatabase from 'firebase-admin/database';

import {
  authorizeFirestore,
  authorizeRtdb,
  verifyFirebase,
} from '../src/factories.js';
import { createFirestorePolicy } from '../src/firestore.js';
import { createRTDBPolicy } from '../src/rtdb.js';
import { verifyFirebaseAdmin } from '../src/verify-admin.js';

// Mock the underlying strategies to inspect calls
vi.mock('../src/firestore.js', () => ({
  createFirestorePolicy: vi.fn(),
  FirestorePolicyConfig: {}, // ensure types don't crash
}));

vi.mock('../src/rtdb.js', () => ({
  createRTDBPolicy: vi.fn(),
}));

vi.mock('../src/verify-admin.js', () => ({
  verifyFirebaseAdmin: vi.fn(),
}));

// Mock Firebase Admin
vi.mock('firebase-admin/app');
vi.mock('firebase-admin/firestore');
vi.mock('firebase-admin/auth');
vi.mock('firebase-admin/database');

describe('packages/firebase/src/factories.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('authorizeFirestore Factory', () => {
    it('should auto-initialize app if none exists', () => {
      // Setup: No apps
      vi.mocked(adminApp.getApps).mockReturnValue([]);
      const mockApp = {} as any;
      vi.mocked(adminApp.initializeApp).mockReturnValue(mockApp);

      const mockDb = { collection: vi.fn() } as any;
      vi.mocked(adminFirestore.getFirestore).mockReturnValue(mockDb);

      authorizeFirestore();

      expect(adminApp.initializeApp).toHaveBeenCalled();
      expect(adminFirestore.getFirestore).toHaveBeenCalledWith(mockApp);
    });

    it('should use existing app if it exists', () => {
      // Setup: App exists
      const mockApp = { name: '[DEFAULT]' } as any;
      vi.mocked(adminApp.getApps).mockReturnValue([mockApp]);

      const mockDb = { collection: vi.fn() } as any;
      vi.mocked(adminFirestore.getFirestore).mockReturnValue(mockDb);

      authorizeFirestore();

      expect(adminApp.initializeApp).not.toHaveBeenCalled();
      expect(adminFirestore.getFirestore).toHaveBeenCalledWith(mockApp);
    });

    it('should use "sessions" collection by default and default ownerField', () => {
      vi.mocked(adminApp.getApps).mockReturnValue([{} as any]); // App exists

      // Mock the collection chain: db.collection(...)
      const mockCollection = { id: 'sessions' };
      const mockDb = { collection: vi.fn().mockReturnValue(mockCollection) };
      vi.mocked(adminFirestore.getFirestore).mockReturnValue(mockDb as any);

      authorizeFirestore();

      expect(mockDb.collection).toHaveBeenCalledWith('sessions');
      expect(createFirestorePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: mockCollection,
          ownerField: 'ownerId',
        }),
      );
    });

    it('should accept custom collection string', () => {
      vi.mocked(adminApp.getApps).mockReturnValue([{} as any]);

      const mockCollection = { id: 'custom' };
      const mockDb = { collection: vi.fn().mockReturnValue(mockCollection) };
      vi.mocked(adminFirestore.getFirestore).mockReturnValue(mockDb as any);

      authorizeFirestore({ collection: 'custom' });

      expect(mockDb.collection).toHaveBeenCalledWith('custom');
      expect(createFirestorePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: mockCollection,
        }),
      );
    });

    it('should accept custom collection object and avoid app init', () => {
      const mockCollection = { id: 'custom-obj' } as any;

      vi.mocked(adminApp.getApps).mockReturnValue([]); // No app exists
      vi.mocked(adminApp.initializeApp).mockReturnValue({} as any);

      authorizeFirestore({ collection: mockCollection });

      // App should NOT be initialized because collection object was provided directly
      expect(adminApp.initializeApp).not.toHaveBeenCalled();
      expect(adminFirestore.getFirestore).not.toHaveBeenCalled();

      expect(createFirestorePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: mockCollection,
        }),
      );
    });
  });

  describe('verifyFirebase Factory', () => {
    it('should auto-initialize app if none exists', () => {
      vi.mocked(adminApp.getApps).mockReturnValue([]);
      const mockApp = {} as any;
      vi.mocked(adminApp.initializeApp).mockReturnValue(mockApp);

      const mockAuth = {} as any;
      vi.mocked(adminAuth.getAuth).mockReturnValue(mockAuth);

      verifyFirebase();

      expect(adminApp.initializeApp).toHaveBeenCalled();
      expect(adminAuth.getAuth).toHaveBeenCalledWith(mockApp);
      expect(verifyFirebaseAdmin).toHaveBeenCalledWith({ auth: mockAuth });
    });

    it('should use provided Auth instance', () => {
      const dummyAuth = {} as any;
      verifyFirebase({ auth: dummyAuth });

      expect(adminApp.getApps).not.toHaveBeenCalled();
      expect(adminApp.initializeApp).not.toHaveBeenCalled();
      expect(verifyFirebaseAdmin).toHaveBeenCalledWith({ auth: dummyAuth });
    });
  });

  describe('authorizeRtdb Factory', () => {
    it('should auto-initialize app and use defaults', () => {
      vi.mocked(adminApp.getApps).mockReturnValue([{} as any]);
      const mockDb = {} as any;
      vi.mocked(adminDatabase.getDatabase).mockReturnValue(mockDb);

      authorizeRtdb();

      expect(adminDatabase.getDatabase).toHaveBeenCalled();
      expect(createRTDBPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          db: mockDb,
          rootPath: 'sessions',
          ownerField: 'ownerId',
        }),
      );
    });

    it('should use provided configuration', () => {
      const mockDb = {} as any;
      authorizeRtdb({
        db: mockDb,
        rootPath: 'custom',
        ownerField: 'customOwner',
      });

      expect(adminApp.getApps).not.toHaveBeenCalled();
      expect(createRTDBPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          db: mockDb,
          rootPath: 'custom',
          ownerField: 'customOwner',
        }),
      );
    });
  });
});
