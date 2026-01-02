import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../../src/client.js';
import { SessionResource, StorageFactory } from '../../src/types.js';
import { ApiClient } from '../../src/api.js';
import {
  MemorySessionStorage,
  MemoryStorage,
} from '../../src/storage/memory.js';
import { mockPlatform } from '../mocks/platform.js';
import { SessionClientImpl } from '../../src/session.js';

const createMockSession = (id: string) =>
  ({
    id,
    name: `sessions/${id}`,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    state: 'completed' as const,
    prompt: 'test',
    title: 'test',
    url: 'http://test.com',
    outputs: [],
    sourceContext: { source: 'github/owner/repo' },
  }) as SessionResource;

describe('Ingestion Depth', () => {
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

  it('Metadata Only: Does not hydrate activities', async () => {
    const session = createMockSession('1');
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        yield session;
      })() as any;
    });
    const sessionSpy = vi.spyOn(client, 'session');

    const stats = await client.sync({ depth: 'metadata' });

    expect(stats.sessionsIngested).toBe(1);
    expect(stats.activitiesIngested).toBe(0);
    expect(sessionSpy).not.toHaveBeenCalled();
  });

  it('Full Hydration: Hydrates activities for each session', async () => {
    const session = createMockSession('1');
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        yield session;
      })() as any;
    });

    const mockSessionClient = new SessionClientImpl(
      '1',
      (client as any).apiClient,
      { pollingIntervalMs: 5000, requestTimeoutMs: 30000 },
      activityStorage,
      sessionStorage,
      mockPlatform,
    );
    const historySpy = vi
      .spyOn(mockSessionClient, 'history')
      .mockImplementation(async function* () {
        yield { id: 'a1' } as any;
        yield { id: 'a2' } as any;
        yield { id: 'a3' } as any;
      });
    const sessionSpy = vi
      .spyOn(client, 'session')
      .mockReturnValue(mockSessionClient);

    const stats = await client.sync({ depth: 'activities' });

    expect(stats.sessionsIngested).toBe(1);
    expect(stats.activitiesIngested).toBe(3);
    expect(sessionSpy).toHaveBeenCalledWith('1');
    expect(historySpy).toHaveBeenCalled();
  });
});
