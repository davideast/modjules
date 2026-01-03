import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JulesClientImpl } from '../../src/client.js';
import { SessionResource } from '../../src/types.js';
import { ApiClient } from '../../src/api.js';

// Mock dependencies
vi.mock('../../src/api');

const createMockSession = (id: string) => ({
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
});

describe('Ingestion Depth', () => {
  let client: JulesClientImpl;
  let mockStorage: any;
  let mockSessionClient: any;

  beforeEach(() => {
    mockStorage = {
      scanIndex: vi.fn(async function* () {}),
      session: vi.fn(),
      upsert: vi.fn(),
    };

    mockSessionClient = {
      history: vi.fn(async function* () {}),
    };

    client = new JulesClientImpl(
      {},
      {
        session: () => mockStorage,
        activity: () => ({
          init: vi.fn(),
          latest: vi.fn(),
          append: vi.fn(),
        }),
      },
      { getEnv: vi.fn() } as any,
    );
    (client as any).apiClient = new ApiClient({
      apiKey: 'test',
      baseUrl: 'test',
      requestTimeoutMs: 1000,
    });

    // Mock session() to return a mock client
    vi.spyOn(client, 'session').mockReturnValue(mockSessionClient as any);
  });

  it('Metadata Only: Does not hydrate activities', async () => {
    const session = createMockSession('1');
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        yield session;
      })() as any;
    });

    const stats = await client.sync({ depth: 'metadata' });

    expect(stats.sessionsIngested).toBe(1);
    expect(stats.activitiesIngested).toBe(0);
    expect(client.session).not.toHaveBeenCalled();
  });

  it('Full Hydration: Hydrates activities for each session', async () => {
    const session = createMockSession('1');
    vi.spyOn(client, 'sessions').mockImplementation(() => {
      return (async function* () {
        yield session;
      })() as any;
    });

    // Mock history to return 3 activities
    mockSessionClient.history.mockImplementation(async function* () {
      yield {};
      yield {};
      yield {};
    });

    const stats = await client.sync({ depth: 'activities' });

    expect(stats.sessionsIngested).toBe(1);
    expect(stats.activitiesIngested).toBe(3);
    expect(client.session).toHaveBeenCalledWith('1');
    expect(mockSessionClient.history).toHaveBeenCalled();
  });
});
