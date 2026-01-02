import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../src/client.js';
import { ApiClient } from '../src/api.js';
import { mockPlatform } from './mocks/platform.js';
import { SessionResource, StorageFactory } from '../src/types.js';
import { MemorySessionStorage, MemoryStorage } from '../src/storage/memory.js';
import { SessionClientImpl } from '../src/session.js';

describe('JulesClient.sync() Repro', () => {
  let client: JulesClientImpl;
  let sessionStorage: MemorySessionStorage;
  let activityStorage: MemoryStorage;
  let storageFactory: StorageFactory;
  let mockApiClient: ApiClient;

  const session1: SessionResource = {
    id: 'session-1',
    name: 'sessions/session-1',
    createTime: '2023-01-01T12:00:00Z',
    updateTime: '2023-01-01T12:00:00Z',
    state: 'inProgress',
    prompt: 'test',
    title: 'test session 1',
    sourceContext: { source: 'test' },
    url: 'http://test.com',
    outputs: [],
  };

  const session2: SessionResource = {
    id: 'session-2',
    name: 'sessions/session-2',
    createTime: '2023-01-02T12:00:00Z', // Newer
    updateTime: '2023-01-02T12:00:00Z',
    state: 'inProgress',
    prompt: 'test',
    title: 'test session 2',
    sourceContext: { source: 'test' },
    url: 'http://test.com',
    outputs: [],
  };

  beforeEach(async () => {
    mockApiClient = new ApiClient({
      apiKey: 'test',
      baseUrl: 'test',
      requestTimeoutMs: 1000,
    });
    sessionStorage = new MemorySessionStorage();
    activityStorage = new MemoryStorage();
    storageFactory = {
      session: () => sessionStorage,
      activity: () => activityStorage,
    };

    // Pre-populate storage with the newer session
    await sessionStorage.upsert(session2);

    client = new JulesClientImpl(
      { apiKey: 'test-key' },
      storageFactory,
      mockPlatform,
    );
    (client as any).apiClient = mockApiClient;
  });

  it('fails to sync activities when session is already downloaded (incremental=true)', async () => {
    const mockCursor = (async function* () {
      yield session2;
      yield session1;
    })();
    vi.spyOn(client, 'sessions').mockReturnValue(mockCursor as any);

    const mockSessionClient = new SessionClientImpl(
      'session-1',
      mockApiClient,
      { pollingIntervalMs: 5000, requestTimeoutMs: 30000 },
      activityStorage,
      sessionStorage,
      mockPlatform,
    );
    vi.spyOn(mockSessionClient, 'history').mockImplementation(
      async function* () {
        yield { id: 'act-1', type: 'agentMessaged' } as any;
      },
    );
    vi.spyOn(client, 'session').mockReturnValue(mockSessionClient);

    const result = await client.sync({
      depth: 'activities',
      incremental: true,
      limit: 10,
    });

    expect(result.sessionsIngested).toBe(1); // session1
    expect(result.activitiesIngested).toBe(1); // act-1
  });
});
