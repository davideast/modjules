import { describe, it, expect, vi } from 'vitest';
import {
  createFirestorePolicy,
  createFirestoreAllowList,
} from '../src/firestore.js';
import { createRTDBPolicy, createRTDBAllowList } from '../src/rtdb.js';
import { withAllowList, normalizeEmailKey } from '../src/utils.js';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import path from 'path';

const spec: any[] = load(
  readFileSync(path.resolve('./spec/cases.yaml'), 'utf8'),
);

const mockUser = { uid: 'user_rtdb', email: 'user@example.com' };

describe('Firebase Policies and Utilities', () => {
  // Firestore Policy
  describe('Firestore Policy', () => {
    const firestorePolicyCases = spec.filter(
      (c) => c.category === 'firestore-policy',
    );
    it.each(firestorePolicyCases)('$description', async ({ given, then }) => {
      const { sessionId, mockDocGet, config } = given;
      const { resource } = then;

      const mockDoc = {
        get: vi
          .fn()
          .mockResolvedValue({ ...mockDocGet, data: () => mockDocGet.data }),
      };
      const mockCollection = { doc: vi.fn().mockReturnValue(mockDoc) };

      const policy = createFirestorePolicy({
        ...config,
        collection: mockCollection as any,
      });

      if (resource) {
        const policyResult = await policy({ uid: 'user_123' }, sessionId);
        expect(policyResult.resource).toEqual(resource);
      } else {
        await expect(policy({ uid: 'user_123' }, sessionId)).rejects.toThrow(
          'Access Denied: Resource not accessible.',
        );
      }
    });
  });

  // Firestore Allow List
  describe('Firestore Allow List', () => {
    const firestoreAllowListCases = spec.filter(
      (c) => c.category === 'firestore-allowlist',
    );
    it.each(firestoreAllowListCases)(
      '$description',
      async ({ given, then }) => {
        const { identity, mockDocGet } = given;
        const { result } = then;

        const mockDoc = {
          get: vi
            .fn()
            .mockResolvedValue({ ...mockDocGet, data: () => mockDocGet.data }),
        };
        const mockCollection = { doc: vi.fn().mockReturnValue(mockDoc) };

        const allowList = createFirestoreAllowList(mockCollection as any);
        const isAllowed = await allowList(identity);

        expect(isAllowed).toBe(result);
      },
    );
  });

  // RTDB Policy
  describe('RTDB Policy', () => {
    const rtdbPolicyCases = spec.filter((c) => c.category === 'rtdb-policy');
    it.each(rtdbPolicyCases)('$description', async ({ given, then }) => {
      const { sessionId, mockSnapshotGet, config } = given;
      const { resource } = then;

      const mockRef = {
        get: vi.fn().mockResolvedValue({
          ...mockSnapshotGet,
          exists: () => mockSnapshotGet.exists,
          val: () => mockSnapshotGet.val,
        }),
      };
      const mockDb = { ref: vi.fn().mockReturnValue(mockRef) };

      const policy = createRTDBPolicy({ ...config, db: mockDb as any });

      if (resource) {
        const policyResult = await policy(mockUser, sessionId);
        expect(policyResult.resource).toEqual(resource);
      } else {
        await expect(policy(mockUser, sessionId)).rejects.toThrow(
          'Access Denied: Resource not accessible.',
        );
      }
    });
  });

  // RTDB Allow List
  describe('RTDB Allow List', () => {
    const rtdbAllowListCases = spec.filter(
      (c) => c.category === 'rtdb-allowlist',
    );
    it.each(rtdbAllowListCases)('$description', async ({ given, then }) => {
      const { identity, mockSnapshotGet } = given;
      const { result } = then;

      const mockRef = {
        get: vi.fn().mockResolvedValue({
          ...mockSnapshotGet,
          exists: () => mockSnapshotGet.exists,
          val: () => mockSnapshotGet.val,
        }),
      };
      const mockDb = { ref: vi.fn().mockReturnValue(mockRef) };

      const allowList = createRTDBAllowList(mockDb as any);
      const isAllowed = await allowList(identity);

      expect(isAllowed).toBe(result);
    });
  });

  // withAllowList Decorator
  describe('withAllowList Decorator', () => {
    const withAllowListCases = spec.filter(
      (c) => c.category === 'with-allowlist',
    );
    it.each(withAllowListCases)('$description', async ({ given, then }) => {
      const { allowed, mockStrategyReturns } = given;
      const { result, error } = then;

      const mockStrategy = vi.fn().mockResolvedValue(mockStrategyReturns);
      const decoratedStrategy = withAllowList(allowed, mockStrategy);

      if (error) {
        await expect(decoratedStrategy('any_token', {} as any)).rejects.toThrow(
          new RegExp(error),
        );
      } else {
        await expect(
          decoratedStrategy('any_token', {} as any),
        ).resolves.toEqual(result);
      }
    });
  });

  // normalizeEmailKey Utility
  describe('normalizeEmailKey Utility', () => {
    const normalizeEmailKeyCases = spec.filter(
      (c) => c.category === 'normalize-email',
    );
    it.each(normalizeEmailKeyCases)('$description', ({ given, then }) => {
      const { email, platform } = given;
      const { result, error } = then;

      if (error) {
        expect(() => normalizeEmailKey(email, platform)).toThrow(
          new RegExp(error),
        );
      } else {
        expect(normalizeEmailKey(email, platform)).toBe(result);
      }
    });
  });
});
