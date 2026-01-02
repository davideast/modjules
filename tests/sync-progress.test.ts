import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../src/client.js';
import { mockPlatform } from './mocks/platform.js';
import { MemorySessionStorage, MemoryStorage } from '../src/storage/memory.js';
import { SessionResource, StorageFactory } from '../src/types.js';
import { SessionClientImpl } from '../src/session.js';

describe('JulesClient.sync Progress', () => {
  let jules: JulesClientImpl;
  let sessionStorage: MemorySessionStorage;
  let activityStorage: MemoryStorage;
  let storageFactory: StorageFactory;

  beforeEach(async () => {
    sessionStorage = new MemorySessionStorage();
    activityStorage = new MemoryStorage();
    storageFactory = {
      session: () => sessionStorage,
      activity: () => activityStorage,
    };
    await sessionStorage.upsert({
      id: 'existing',
      createTime: '2023-01-01T00:00:00Z',
    } as SessionResource);

    jules = new JulesClientImpl(
      { apiKey: 'test' },
      storageFactory,
      mockPlatform,
    );
  });

  it('should report detailed progress during activity hydration', async () => {
    const mockSession = {
      id: 'session-123',
      createTime: '2024-01-01T00:00:00Z',
    } as SessionResource;
    vi.spyOn(jules, 'sessions').mockReturnValue(
      (async function* () {
        yield mockSession;
      })() as any,
    );

    const mockSessionClient = new SessionClientImpl(
      'session-123',
      (jules as any).apiClient,
      { pollingIntervalMs: 5000, requestTimeoutMs: 30000 },
      activityStorage,
      sessionStorage,
      mockPlatform,
    );
    vi.spyOn(mockSessionClient, 'history').mockImplementation(
      async function* () {
        yield { id: 'act-1' } as any;
        yield { id: 'act-2' } as any;
        yield { id: 'act-3' } as any;
      },
    );
    vi.spyOn(jules, 'session').mockReturnValue(mockSessionClient);

    const onProgress = vi.fn();

    await jules.sync({
      depth: 'activities',
      incremental: false, // Force fetch
      onProgress,
    });

    // Check progress calls
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 0,
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 1,
      lastIngestedId: 'session-123',
    });
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 0,
      total: 1,
    });
    // This is the final hydration update, not intermediate ones.
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 1,
      total: 1,
      lastIngestedId: 'session-123',
    });
  });
});
