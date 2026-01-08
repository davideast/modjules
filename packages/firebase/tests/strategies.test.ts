import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyFirebaseRest } from '../src/verify-rest.js';
import { verifyFirebaseAdmin } from '../src/verify-admin.js';
import { createMockPlatform } from '../../core/tests/mocks/platform.js';
import { load } from 'js-yaml';
import { readFileSync } from 'fs';
import path from 'path';

const mocks = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn();
  const mockAuth = {
    verifyIdToken: mockVerifyIdToken,
  };
  return {
    mockVerifyIdToken,
    mockAuth,
  };
});

const mockPlatform = createMockPlatform();

const spec: any[] = load(
  readFileSync(path.resolve('./spec/cases.yaml'), 'utf8'),
);

describe('Firebase Auth Strategies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Firebase REST (Portable Strategy)', () => {
    const restCases = spec.filter((c) => c.category === 'firebase-rest');

    it.each(restCases)('$description', async (spec) => {
      const { given, then } = spec;
      const { config, token, mockFetch } = given;
      const { result, error } = then;

      if (mockFetch) {
        (mockPlatform.fetch as any).mockResolvedValue({
          ok: mockFetch.response.ok,
          text: async () => JSON.stringify(mockFetch.response.json),
          json: async () => mockFetch.response.json,
          status: mockFetch.response.status,
        });
      }

      const strategy = verifyFirebaseRest(config);

      if (error) {
        await expect(strategy(token, mockPlatform)).rejects.toThrow(
          new RegExp(error),
        );
      } else {
        await expect(strategy(token, mockPlatform)).resolves.toEqual(result);
      }
    });
  });

  describe('Firebase Admin SDK (Node.js Strategy)', () => {
    const adminCases = spec.filter((c) => c.category === 'firebase-admin');

    it.each(adminCases)('$description', async (spec) => {
      const { given, then } = spec;
      const { config, token, mockVerifyIdToken } = given;
      const { result, error } = then;

      if (mockVerifyIdToken) {
        if (mockVerifyIdToken.resolves) {
          mocks.mockVerifyIdToken.mockResolvedValue(mockVerifyIdToken.resolves);
        } else {
          mocks.mockVerifyIdToken.mockRejectedValue(
            new Error(mockVerifyIdToken.rejects.message),
          );
        }
      }

      const strategy = verifyFirebaseAdmin({
        ...config,
        auth: mocks.mockAuth as any,
      });

      if (error) {
        await expect(strategy(token, mockPlatform)).rejects.toThrow(
          new RegExp(error),
        );
      } else {
        await expect(strategy(token, mockPlatform)).resolves.toEqual(result);
      }
    });
  });
});
