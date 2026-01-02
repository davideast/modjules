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

describe('Congestion Control', () => {
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

  it('Concurrency Verification: Ensures tasks run sequentially when concurrency is 1', async () => {
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
          await new Promise((r) => setTimeout(r, 100));
          yield { id: 'a1' } as any;
        },
      );
      return mockSessionClient;
    });

    const start = Date.now();
    await client.sync({ depth: 'activities', limit: 3, concurrency: 1 });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(300);
  });

  it('Resilience: Partial success on network interruption', async () => {
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

    let callCount = 0;
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
          callCount++;
          if (callCount === 3) throw new Error('Network Error');
          yield { id: 'a1' } as any;
        },
      );
      return mockSessionClient;
    });

    await expect(
      client.sync({ depth: 'activities', concurrency: 1 }),
    ).rejects.toThrow('Network Error');

    expect(callCount).toBe(3);
  });
});
