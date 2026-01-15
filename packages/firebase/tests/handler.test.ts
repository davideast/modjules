// packages/firebase/tests/handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFirebaseHandler } from '../src/handler.js';
import * as adminApp from 'firebase-admin/app';
import * as adminFirestore from 'firebase-admin/firestore';
import * as adminAuth from 'firebase-admin/auth';
import { createNodeHandler } from '@modjules/server/node';

// Mock dependencies
vi.mock('firebase-admin/app');
vi.mock('firebase-admin/firestore');
vi.mock('firebase-admin/auth');

// Mock @modjules/server/node
vi.mock('@modjules/server/node', () => ({
  createNodeHandler: vi.fn(),
}));

// Mock factories
vi.mock('../src/factories.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/factories.js')>();
  return {
    ...actual,
    verifyFirebase: vi.fn().mockReturnValue('mock-verify'),
    authorizeFirestore: vi.fn().mockReturnValue('mock-authorize'),
  };
});

describe('createFirebaseHandler', () => {
  const mockApiKey = 'sk_test_1234567890';
  const mockClientSecret = 'mock-secret';

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(adminApp.getApps).mockReturnValue([{} as any]);
    vi.mocked(adminApp.initializeApp).mockReturnValue({} as any);

    const { verifyFirebase, authorizeFirestore } = await import(
      '../src/factories.js'
    );
    vi.mocked(verifyFirebase).mockReturnValue('mock-verify' as any);
    vi.mocked(authorizeFirestore).mockReturnValue('mock-authorize' as any);
  });

  it('should create a handler with minimal config', async () => {
    vi.mocked(createNodeHandler).mockReturnValue('mock-handler' as any);

    const handler = await createFirebaseHandler({
      apiKey: mockApiKey,
      clientSecret: mockClientSecret,
    });

    expect(handler).toBe('mock-handler');
    expect(createNodeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: mockApiKey,
        clientSecret: mockClientSecret,
        verify: 'mock-verify',
        authorize: 'mock-authorize',
      }),
    );
  });

  it('should validate API key format', async () => {
    await expect(
      createFirebaseHandler({
        apiKey: 'short',
        clientSecret: mockClientSecret,
      }),
    ).rejects.toThrow('API key must be at least 10 characters');
  });

  it('should validate Client Secret is required', async () => {
    await expect(
      createFirebaseHandler({
        apiKey: mockApiKey,
        clientSecret: '',
      }),
    ).rejects.toThrow('Client Secret is required');
  });

  it('should allow custom collection name', async () => {
    await createFirebaseHandler({
      apiKey: mockApiKey,
      clientSecret: mockClientSecret,
      collectionName: 'my-custom-collection',
    });

    const { authorizeFirestore } = await import('../src/factories.js');
    expect(authorizeFirestore).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'my-custom-collection',
      }),
    );
  });

  it('should allow dependency injection of firebase services', async () => {
    const mockApp = { name: 'mock-app' } as any;
    const mockAuth = {} as any;
    const mockFirestore = {} as any;

    await createFirebaseHandler({
      apiKey: mockApiKey,
      clientSecret: mockClientSecret,
      app: mockApp,
      auth: mockAuth,
      firestore: mockFirestore,
    });

    const { verifyFirebase, authorizeFirestore } = await import(
      '../src/factories.js'
    );

    expect(verifyFirebase).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: mockAuth,
      }),
    );

    expect(authorizeFirestore).toHaveBeenCalledWith(
      expect.objectContaining({
        firestore: mockFirestore,
      }),
    );
  });

  it('should allow overriding verify and authorize strategies', async () => {
    const customVerify = vi.fn();
    const customAuthorize = vi.fn();

    await createFirebaseHandler({
      apiKey: mockApiKey,
      clientSecret: mockClientSecret,
      verify: customVerify,
      authorize: customAuthorize,
    });

    expect(createNodeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        verify: customVerify,
        authorize: customAuthorize,
      }),
    );
  });
});
