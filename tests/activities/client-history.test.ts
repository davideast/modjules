import { describe, it, expect, vi } from 'vitest';
import { DefaultActivityClient } from '../../src/activities/client.js';
import { Activity } from '../../src/types.js';
import { ActivityStorage } from '../../src/storage/types.js';
import { NetworkClient } from '../../src/activities/client.js';

// Mock storage factory
const createMockStorage = (activities: Activity[] = []): ActivityStorage => {
  let stored = [...activities];
  return {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    append: vi.fn().mockImplementation(async (act: Activity) => {
      stored.push(act);
    }),
    get: vi
      .fn()
      .mockImplementation(async (id: string) =>
        stored.find((a) => a.id === id),
      ),
    latest: vi.fn().mockImplementation(async () => stored[stored.length - 1]),
    scan: vi.fn().mockImplementation(async function* () {
      yield* stored;
    }),
  };
};

// Mock network factory
const createMockNetwork = (pages: Activity[][]): NetworkClient => {
  let pageIndex = 0;
  return {
    listActivities: vi.fn().mockImplementation(async () => {
      const activities = pages[pageIndex] || [];
      const hasMore = pageIndex < pages.length - 1;
      pageIndex++;
      return {
        activities,
        nextPageToken: hasMore ? `page-${pageIndex}` : undefined,
      };
    }),
    fetchActivity: vi.fn().mockResolvedValue({} as Activity),
    rawStream: vi.fn().mockImplementation(async function* () {
      yield* [];
    }),
  };
};

describe('DefaultActivityClient.history()', () => {
  it('returns activities from cache when available (after hydrate)', async () => {
    const cachedActivities = [
      { id: '1', createTime: '2024-01-01T00:00:00Z' } as Activity,
      { id: '2', createTime: '2024-01-02T00:00:00Z' } as Activity,
    ];

    const storage = createMockStorage(cachedActivities);
    // Network returns empty since all activities are already cached
    const network = createMockNetwork([]);
    const client = new DefaultActivityClient(storage, network);

    const result: Activity[] = [];
    for await (const act of client.history()) {
      result.push(act);
    }

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
    // history() now always calls hydrate() first, which calls listActivities
    expect(network.listActivities).toHaveBeenCalledTimes(1);
    // No new activities were appended since they were all in cache
    expect(storage.append).not.toHaveBeenCalled();
  });

  it('fetches from network when cache is empty', async () => {
    const networkActivities = [
      { id: '1', createTime: '2024-01-01T00:00:00Z' } as Activity,
      { id: '2', createTime: '2024-01-02T00:00:00Z' } as Activity,
    ];

    const storage = createMockStorage([]); // Empty cache
    const network = createMockNetwork([networkActivities]);
    const client = new DefaultActivityClient(storage, network);

    const result: Activity[] = [];
    for await (const act of client.history()) {
      result.push(act);
    }

    expect(result).toHaveLength(2);
    expect(network.listActivities).toHaveBeenCalledTimes(1);
    expect(storage.append).toHaveBeenCalledTimes(2);
  });

  it('handles paginated network responses', async () => {
    const page1 = [{ id: '1', createTime: '2024-01-01T00:00:00Z' } as Activity];
    const page2 = [{ id: '2', createTime: '2024-01-02T00:00:00Z' } as Activity];
    const page3 = [{ id: '3', createTime: '2024-01-03T00:00:00Z' } as Activity];

    const storage = createMockStorage([]);
    const network = createMockNetwork([page1, page2, page3]);
    const client = new DefaultActivityClient(storage, network);

    const result: Activity[] = [];
    for await (const act of client.history()) {
      result.push(act);
    }

    expect(result).toHaveLength(3);
    expect(network.listActivities).toHaveBeenCalledTimes(3);
  });

  it('hydrates all activities before yielding from storage', async () => {
    const activities = [
      { id: '1', createTime: '2024-01-01T00:00:00Z' } as Activity,
      { id: '2', createTime: '2024-01-02T00:00:00Z' } as Activity,
    ];

    const storage = createMockStorage([]);
    const network = createMockNetwork([activities]);
    const client = new DefaultActivityClient(storage, network);

    const yielded: string[] = [];
    for await (const act of client.history()) {
      yielded.push(act.id);
      // Since hydrate() runs first, all activities are appended before yielding starts
      // After any yield, all activities should have been appended during hydrate
      expect(storage.append).toHaveBeenCalledTimes(2);
    }

    expect(yielded).toEqual(['1', '2']);
  });
});

describe('DefaultActivityClient.hydrate()', () => {
  it('syncs all activities from network', async () => {
    const activities = [
      { id: '1', createTime: '2024-01-01T00:00:00Z' } as Activity,
      { id: '2', createTime: '2024-01-02T00:00:00Z' } as Activity,
    ];

    const storage = createMockStorage([]);
    const network = createMockNetwork([activities]);
    const client = new DefaultActivityClient(storage, network);

    const count = await client.hydrate();

    expect(count).toBe(2);
    expect(storage.append).toHaveBeenCalledTimes(2);
  });

  it('skips activities already in cache', async () => {
    const existing = {
      id: '1',
      createTime: '2024-01-01T00:00:00Z',
    } as Activity;
    const newActivity = {
      id: '2',
      createTime: '2024-01-02T00:00:00Z',
    } as Activity;

    const storage = createMockStorage([existing]);
    const network = createMockNetwork([[existing, newActivity]]);
    const client = new DefaultActivityClient(storage, network);

    const count = await client.hydrate();

    expect(count).toBe(1); // Only the new one
    expect(storage.append).toHaveBeenCalledTimes(1);
    expect(storage.append).toHaveBeenCalledWith(newActivity);
  });
});
