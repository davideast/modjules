import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../src/client.js';
import { mockPlatform } from './mocks/platform.js';

describe('JulesClient.sync Progress', () => {
  let jules: JulesClientImpl;
  let mockStorage: any;
  let mockApiClient: any;

  beforeEach(() => {
    // Mock Session Storage
    const mockSessionStorage = {
      scanIndex: async function* () {
        yield { createTime: '2023-01-01T00:00:00Z' };
      },
      upsert: vi.fn(),
      get: vi.fn(),
    };

    // Mock Activity Storage
    const mockActivityStorage = {
      scan: async function* () {},
      upsert: vi.fn(),
      init: vi.fn(),
      latest: vi.fn(),
      append: vi.fn(),
    };

    mockStorage = {
      session: () => mockSessionStorage,
      activity: () => mockActivityStorage,
    };

    // Mock ApiClient inside JulesClient
    // We can't easily mock private properties, so we'll mock the module or intercept requests?
    // Easier to stub `sessions` and `session` methods on the instance.
    jules = new JulesClientImpl({ apiKey: 'test' }, mockStorage, mockPlatform);
  });

  it('should report detailed progress during activity hydration', async () => {
    // Mock sessions() to return one session
    const mockSession = {
      id: 'session-123',
      createTime: '2024-01-01T00:00:00Z',
    };
    jules.sessions = vi.fn().mockReturnValue(
      (async function* () {
        yield mockSession;
      })(),
    );

    // Mock session() to return a client with history()
    const mockSessionClient = {
      history: vi.fn().mockReturnValue(
        (async function* () {
          yield { id: 'act-1' };
          yield { id: 'act-2' };
          yield { id: 'act-3' };
        })(),
      ),
    };
    jules.session = vi.fn().mockReturnValue(mockSessionClient as any);

    const onProgress = vi.fn();

    await jules.sync({
      depth: 'activities',
      incremental: false, // Force fetch
      onProgress,
    });

    // Check progress calls
    // 1. Initial
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 0,
    });

    // 2. Fetching list done for 1 session
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 1,
      lastIngestedId: 'session-123',
    });

    // 3. Start hydrating
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 0,
      total: 1,
    });

    // 4. Hydrating activities
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_activities',
      current: 0,
      total: 1,
      lastIngestedId: 'session-123',
      activityCount: 1,
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_activities',
      current: 0,
      total: 1,
      lastIngestedId: 'session-123',
      activityCount: 2,
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_activities',
      current: 0,
      total: 1,
      lastIngestedId: 'session-123',
      activityCount: 3,
    });

    // 5. Done hydrating
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 1,
      total: 1,
      lastIngestedId: 'session-123',
    });
  });
});
