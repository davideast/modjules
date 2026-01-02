import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../../src/client.js';
import { SessionResource, StorageFactory } from '../../src/types.js';
import { ApiClient } from '../../src/api.js';
import { MemorySessionStorage } from '../../src/storage/memory.js';
import { mockPlatform } from '../mocks/platform.js';

// Helper to create mock sessions
const createMockSession = (
  id: string,
  createTime: string,
): SessionResource => ({
  id,
  name: `sessions/${id}`,
  createTime,
  updateTime: createTime,
  state: 'completed',
  prompt: 'test',
  title: 'test',
  url: 'http://test.com',
  outputs: [],
  sourceContext: { source: 'github/owner/repo' },
});

describe('Reconciliation Engine', () => {
  let client: JulesClientImpl;
  let sessionStorage: MemorySessionStorage;
  let mockApiClient: ApiClient;
  let storageFactory: StorageFactory;

  beforeEach(() => {
    sessionStorage = new MemorySessionStorage();
    storageFactory = {
      session: () => sessionStorage,
      activity: vi.fn() as any,
    };

    mockApiClient = new ApiClient({
      apiKey: 'test',
      baseUrl: 'test',
      requestTimeoutMs: 1000,
    });

    client = new JulesClientImpl({}, storageFactory, mockPlatform);
    (client as any).apiClient = mockApiClient;
  });

  it('Cold Start: Ingests all sessions when cache is empty', async () => {
    const sessions = [
      createMockSession('1', '2023-01-01T00:00:00Z'),
      createMockSession('2', '2023-01-02T00:00:00Z'),
      createMockSession('3', '2023-01-03T00:00:00Z'),
      createMockSession('4', '2023-01-04T00:00:00Z'),
      createMockSession('5', '2023-01-05T00:00:00Z'),
    ];

    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        for (const s of sessions) yield s;
      })() as any;
    });

    const upsertSpy = vi.spyOn(sessionStorage, 'upsert');
    const stats = await client.sync({ depth: 'metadata' });

    expect(stats.sessionsIngested).toBe(5);
    expect(upsertSpy).toHaveBeenCalledTimes(5);
  });

  it('Incremental Sync: Stops at High-Water Mark', async () => {
    const monday = '2023-01-02T00:00:00Z';
    const tuesday = '2023-01-03T00:00:00Z';

    // Pre-populate storage
    await sessionStorage.upsert(createMockSession('1', monday));

    const sessions = [
      createMockSession('2', tuesday),
      createMockSession('1', monday),
    ];

    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        for (const s of sessions) yield s;
      })() as any;
    });

    const upsertSpy = vi.spyOn(sessionStorage, 'upsert');
    const stats = await client.sync({ depth: 'metadata', incremental: true });

    expect(stats.sessionsIngested).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' }),
    );
  });

  it('Limit Enforcement: Respects the limit option', async () => {
    const sessions = Array.from({ length: 100 }, (_, i) =>
      createMockSession(`${i}`, new Date().toISOString()),
    );

    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        for (const s of sessions) yield s;
      })() as any;
    });

    const upsertSpy = vi.spyOn(sessionStorage, 'upsert');
    const stats = await client.sync({ limit: 10, depth: 'metadata' });

    expect(stats.sessionsIngested).toBe(10);
    expect(upsertSpy).toHaveBeenCalledTimes(10);
  });
});
