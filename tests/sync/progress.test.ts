import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../../src/client.js';
import { ApiClient } from '../../src/api.js';
import {
  MemorySessionStorage,
  MemoryStorage,
} from '../../src/storage/memory.js';
import { SessionResource, StorageFactory } from '../../src/types.js';
import { mockPlatform } from '../mocks/platform.js';
import { SessionClientImpl } from '../../src/session.js';

describe('Observability', () => {
  let client: JulesClientImpl;
  let sessionStorage: MemorySessionStorage;
  let activityStorage: MemoryStorage;
  let storageFactory: StorageFactory;

  beforeEach(() => {
    sessionStorage = new MemorySessionStorage();
    activityStorage = new MemoryStorage();
    storageFactory = {
      session: () => sessionStorage,
      activity: () => activityStorage,
    };

    client = new JulesClientImpl({}, storageFactory, mockPlatform);
    (client as any).apiClient = new ApiClient({
      apiKey: 'test',
      baseUrl: 'test',
      requestTimeoutMs: 1000,
    });
  });

  it('Progress Callbacks: Reports progress correctly', async () => {
    const session = {
      id: '1',
      createTime: new Date().toISOString(),
    } as SessionResource;
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        yield session;
      })() as any;
    });

    // Mock session() to return a client that can hydrate
    const mockSessionClient = new SessionClientImpl(
      '1',
      (client as any).apiClient,
      { pollingIntervalMs: 5000, requestTimeoutMs: 30000 },
      activityStorage,
      sessionStorage,
      mockPlatform,
    );
    vi.spyOn(mockSessionClient, 'history').mockImplementation(async function* (
      this: SessionClientImpl,
    ) {
      yield { id: 'a1', createTime: new Date().toISOString() } as any;
    });
    vi.spyOn(client, 'session').mockReturnValue(mockSessionClient);

    const onProgress = vi.fn();
    await client.sync({ depth: 'activities', onProgress });

    // 1. Initial fetch start
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 0,
    });

    // 2. Fetching list progress
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'fetching_list',
      current: 1,
      lastIngestedId: '1',
    });

    // 3. Hydration start
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 0,
      total: 1,
    });

    // 4. Hydration progress
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'hydrating_records',
      current: 1,
      total: 1,
      lastIngestedId: '1',
    });
  });

  it('Progress Callbacks: Monotonic updates with concurrency', async () => {
    const sessions = [
      { id: '1', createTime: new Date().toISOString() },
      { id: '2', createTime: new Date().toISOString() },
      { id: '3', createTime: new Date().toISOString() },
    ] as SessionResource[];
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        for (const s of sessions) yield s;
      })() as any;
    });

    vi.spyOn(client, 'session').mockImplementation((sessionId: any) => {
      const mockSessionClient = new SessionClientImpl(
        sessionId,
        (client as any).apiClient,
        { pollingIntervalMs: 5000, requestTimeoutMs: 30000 },
        activityStorage,
        sessionStorage,
        mockPlatform,
      );
      vi.spyOn(mockSessionClient, 'history').mockImplementation(
        async function* () {
          yield { id: 'a1', createTime: new Date().toISOString() } as any;
        },
      );
      return mockSessionClient;
    });

    const onProgress = vi.fn();
    await client.sync({ depth: 'activities', onProgress, concurrency: 3 });

    const hydrationCalls = onProgress.mock.calls.filter(
      (args) => args[0].phase === 'hydrating_records' && args[0].current > 0,
    );

    expect(hydrationCalls.length).toBe(3);

    const currents = hydrationCalls.map((args) => args[0].current);
    expect(currents).toEqual([1, 2, 3]);
  });
});
