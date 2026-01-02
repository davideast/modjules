import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jules } from '../../src/index.js';
import { ApiClient } from '../../src/api.js';
import { SessionResource } from '../../src/types.js';

// Mock dependencies
// We mock the module to intercept the class constructor
vi.mock('../../src/api.js', async () => {
  const actual = await vi.importActual('../../src/api.js');
  return {
    ...actual,
    ApiClient: vi.fn(),
  };
});

describe('jules.select() Network Isolation Spec', () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Setup Mock API Client
    mockRequest = vi.fn();
    (ApiClient as any).mockImplementation(() => ({
      request: mockRequest,
    }));
  });

  it('should NOT trigger network requests for activities during select', async () => {
    // We instantiate a fresh client to ensure mocks are used
    const client = jules.with({ apiKey: 'test' });

    // 1. Setup Local State
    // We use a unique ID to avoid collision with other tests if storage persists
    const sessionId = `sessions/isolation-spec-${Date.now()}`;
    const dummySession: SessionResource = {
      id: sessionId,
      name: sessionId,
      state: 'inProgress',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      title: 'Test Session',
      sourceContext: { source: 'github/owner/repo' },
      outputs: [],
      url: 'http://test',
      prompt: 'test',
    };

    await client.storage.upsert(dummySession);

    // 2. Execute select with include: activities
    // This should find the session locally.
    // It should NOT try to fetch activities from network even though they are missing locally.
    const results = await client.select({
      from: 'sessions',
      select: ['id'],
      include: {
        activities: true,
      },
    });

    // 3. Assertions
    // Filter calls to see if any activity requests were made
    const activityCalls = mockRequest.mock.calls.filter((args: any[]) =>
      args[0].includes('activities'),
    );

    // STRICTLY ZERO network calls for activities
    expect(activityCalls.length).toBe(0);

    // Verify we actually got the session back
    const found = results.find((s) => s.id === sessionId);
    expect(found).toBeDefined();
    // Activities should be an empty array (since they are missing locally)
    // rather than undefined or crashing
    expect(found?.activities).toEqual([]);
  });
});
