import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifySharedSecret,
  verifyFirebaseRest,
} from '../../src/auth/strategies/portable.js';
import { verifyFirebaseAdmin } from '../../src/auth/strategies/node.js';
import { createMockPlatform } from '../mocks/platform.js';

// Use vi.hoisted to create variables that can be accessed inside vi.mock
const mocks = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn();
  const mockApp = {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
    options: {},
    name: 'mock-app',
  };
  const mockInitializeApp = vi.fn(() => mockApp as any);
  return {
    mockVerifyIdToken,
    mockApp,
    mockInitializeApp,
  };
});

// Mock the whole admin module
vi.mock('firebase-admin', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase-admin')>();
  return {
    ...original,
    // Mock the named exports
    initializeApp: mocks.mockInitializeApp,
    app: vi.fn(() => mocks.mockApp as any),
    auth: vi.fn(() => ({ verifyIdToken: mocks.mockVerifyIdToken })),
    // Mock the default export for CJS/ESM compatibility if needed
    default: {
      ...(original as any).default,
      initializeApp: mocks.mockInitializeApp,
      app: vi.fn(() => mocks.mockApp as any),
    },
  };
});

const mockPlatform = createMockPlatform();

describe('Auth Strategies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Shared Secret (Portable)', () => {
    it('allows correct secret and returns Identity', async () => {
      const strategy = verifySharedSecret({ secret: 'hunter2' });
      await expect(strategy('hunter2', mockPlatform)).resolves.toEqual({
        uid: 'admin_user',
      });
    });

    it('blocks incorrect secret', async () => {
      const strategy = verifySharedSecret({ secret: 'hunter2' });
      await expect(strategy('wrong', mockPlatform)).rejects.toThrow(
        /Unauthorized/,
      );
    });
  });

  // -------------------------------------------------------------

  describe('Firebase REST (Portable Strategy)', () => {
    const apiKey = 'AIza...';

    it('parses successful response correctly', async () => {
      // Setup Mock Platform to return a successful Firebase REST response
      (mockPlatform.fetch as any).mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            users: [{ localId: 'uid_123', email: 'test@example.com' }],
          }),
        json: async () => ({
          users: [{ localId: 'uid_123', email: 'test@example.com' }],
        }),
        status: 200,
      });

      const strategy = verifyFirebaseRest({ apiKey });
      const identity = await strategy('valid_jwt', mockPlatform);

      expect(identity).toEqual({ uid: 'uid_123', email: 'test@example.com' });
      expect(mockPlatform.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`key=${apiKey}`),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws an error on invalid API key or network failure', async () => {
      // Setup Mock Platform to return a network failure (e.g., 400 Bad Request)
      (mockPlatform.fetch as any).mockResolvedValue({
        ok: false,
        text: async () => 'INVALID_KEY',
        status: 400,
      });

      const strategy = verifyFirebaseRest({ apiKey });

      await expect(strategy('invalid_jwt', mockPlatform)).rejects.toThrow(
        /Firebase Auth Failed/,
      );
    });
  });

  // -------------------------------------------------------------

  describe('Firebase Admin SDK (Node.js Strategy)', () => {
    it('successfully verifies a valid ID token', async () => {
      // Mock the Firebase Admin response
      mocks.mockVerifyIdToken.mockResolvedValue({
        uid: 'admin_uid_456',
        email: 'admin@modjules.dev',
      });

      const strategy = verifyFirebaseAdmin();
      const identity = await strategy('secure_jwt', mockPlatform); // platform is ignored

      expect(identity).toEqual({
        uid: 'admin_uid_456',
        email: 'admin@modjules.dev',
      });
      expect(mocks.mockVerifyIdToken).toHaveBeenCalledWith('secure_jwt');
      expect(mocks.mockInitializeApp).toHaveBeenCalledTimes(1);
    });

    it('throws an error for an invalid ID token', async () => {
      // Mock the Firebase Admin to throw an error
      mocks.mockVerifyIdToken.mockRejectedValue(
        new Error('Firebase ID token has expired.'),
      );

      const strategy = verifyFirebaseAdmin();

      await expect(strategy('expired_jwt', mockPlatform)).rejects.toThrow(
        /Invalid Firebase ID Token/,
      );
    });

    it('throws an error if token is missing', async () => {
      const strategy = verifyFirebaseAdmin();
      await expect(strategy('', mockPlatform)).rejects.toThrow(
        /token is missing/,
      );
    });
  });
});
