import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DefaultActivityClient,
  NetworkClient,
} from '../../src/activities/client.js';
import { ActivityStorage } from '../../src/storage/types.js';
import { ActivityAgentMessaged } from '../../src/types.js';

// Helper to create dummy activities
const createActivity = (
  id: string,
  createTime: string,
  type: string = 'agentMessaged',
): ActivityAgentMessaged =>
  ({
    name: `sessions/s1/activities/${id}`,
    id,
    type,
    message: `Message ${id}`,
    createTime,
    originator: 'agent',
    artifacts: [],
  }) as ActivityAgentMessaged;

describe('DefaultActivityClient', () => {
  let storageMock: ActivityStorage;
  let networkMock: NetworkClient;
  let client: DefaultActivityClient;

  beforeEach(() => {
    storageMock = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      append: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
      latest: vi.fn().mockResolvedValue(undefined),
      scan: vi.fn().mockImplementation(async function* () {
        yield* [];
      }),
    };
    networkMock = {
      rawStream: vi.fn().mockImplementation(async function* () {
        yield* [];
      }),
      listActivities: vi.fn().mockResolvedValue({ activities: [] }),
      fetchActivity: vi.fn().mockResolvedValue(undefined),
    };
    client = new DefaultActivityClient(storageMock, networkMock);
  });

  describe('history()', () => {
    it('should initialize storage and yield activities from storage.scan()', async () => {
      const mockActivities = [
        createActivity('a1', '2023-10-26T10:00:00Z'),
        createActivity('a2', '2023-10-26T10:01:00Z'),
      ];

      storageMock.scan = vi.fn().mockImplementation(async function* () {
        yield* mockActivities;
      });

      const result = [];
      for await (const activity of client.history()) {
        result.push(activity);
      }

      expect(storageMock.init).toHaveBeenCalledTimes(1);
      expect(storageMock.scan).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockActivities);
    });
  });

  describe('updates()', () => {
    it('should yield new activities and persist them to storage', async () => {
      const newActivity = createActivity('a1', '2023-10-26T10:00:00Z');
      networkMock.rawStream = vi.fn().mockImplementation(async function* () {
        yield newActivity;
      });

      // No previous activities
      storageMock.latest = vi.fn().mockResolvedValue(undefined);

      const result = [];
      for await (const activity of client.updates()) {
        result.push(activity);
      }

      expect(storageMock.init).toHaveBeenCalledTimes(1);
      expect(storageMock.latest).toHaveBeenCalledTimes(1);
      expect(storageMock.append).toHaveBeenCalledWith(newActivity);
      expect(result).toEqual([newActivity]);
    });

    it('should filter out activities older than high-water mark', async () => {
      const oldActivity = createActivity('a1', '2023-10-26T09:00:00Z');
      const latestStored = createActivity('a2', '2023-10-26T10:00:00Z');
      const newActivity = createActivity('a3', '2023-10-26T11:00:00Z');

      storageMock.latest = vi.fn().mockResolvedValue(latestStored);
      networkMock.rawStream = vi.fn().mockImplementation(async function* () {
        yield oldActivity;
        yield latestStored; // Should also be filtered out by ID check if times match exactly
        yield newActivity;
      });

      const result = [];
      for await (const activity of client.updates()) {
        result.push(activity);
      }

      expect(result).toEqual([newActivity]);
      expect(storageMock.append).toHaveBeenCalledTimes(1);
      expect(storageMock.append).toHaveBeenCalledWith(newActivity);
    });

    it('should deduplicate activities with same timestamp AND id as high-water mark', async () => {
      const latestStored = createActivity('a1', '2023-10-26T10:00:00Z');
      // Same time, different ID -> should be yielded
      const sameTimeDiffId = createActivity('a2', '2023-10-26T10:00:00Z');

      storageMock.latest = vi.fn().mockResolvedValue(latestStored);
      networkMock.rawStream = vi.fn().mockImplementation(async function* () {
        yield latestStored; // Should be skipped
        yield sameTimeDiffId; // Should be yielded
      });

      const result = [];
      for await (const activity of client.updates()) {
        result.push(activity);
      }

      expect(result).toEqual([sameTimeDiffId]);
      expect(storageMock.append).toHaveBeenCalledWith(sameTimeDiffId);
    });
  });

  describe('stream()', () => {
    it('should yield history then updates', async () => {
      const historyActivity = createActivity('a1', '2023-10-26T10:00:00Z');
      const updateActivity = createActivity('a2', '2023-10-26T11:00:00Z');

      storageMock.scan = vi.fn().mockImplementation(async function* () {
        yield historyActivity;
      });
      // updates() calls latest(), so we need to make sure it returns the last one from history
      storageMock.latest = vi.fn().mockResolvedValue(historyActivity);

      networkMock.rawStream = vi.fn().mockImplementation(async function* () {
        // raw stream might yield everything again, updates() should filter
        yield historyActivity;
        yield updateActivity;
      });

      const result = [];
      for await (const activity of client.stream()) {
        result.push(activity);
      }

      expect(result).toEqual([historyActivity, updateActivity]);
      expect(storageMock.scan).toHaveBeenCalledTimes(1);
      expect(storageMock.latest).toHaveBeenCalledTimes(1);
    });
  });

  describe('select()', () => {
    const a1 = createActivity('a1', '2023-10-26T10:00:00Z', 'typeA');
    const a2 = createActivity('a2', '2023-10-26T10:01:00Z', 'typeB');
    const a3 = createActivity('a3', '2023-10-26T10:02:00Z', 'typeA');
    const a4 = createActivity('a4', '2023-10-26T10:03:00Z', 'typeC');
    const a5 = createActivity('a5', '2023-10-26T10:04:00Z', 'typeA');

    beforeEach(() => {
      storageMock.scan = vi.fn().mockImplementation(async function* () {
        yield a1;
        yield a2;
        yield a3;
        yield a4;
        yield a5;
      });
    });

    it('should return all activities if no options provided', async () => {
      const results = await client.select();
      expect(results).toEqual([a1, a2, a3, a4, a5]);
      expect(storageMock.init).toHaveBeenCalledTimes(1);
    });

    it('should filter by type', async () => {
      const results = await client.select({ type: 'typeA' });
      expect(results).toEqual([a1, a3, a5]);
    });

    it('should support "after" cursor (exclusive)', async () => {
      const results = await client.select({ after: 'a2' });
      expect(results).toEqual([a3, a4, a5]);
    });

    it('should support "before" cursor (exclusive)', async () => {
      const results = await client.select({ before: 'a4' });
      expect(results).toEqual([a1, a2, a3]);
    });

    it('should support both "after" and "before" cursors', async () => {
      const results = await client.select({ after: 'a1', before: 'a5' });
      expect(results).toEqual([a2, a3, a4]);
    });

    it('should support limit', async () => {
      const results = await client.select({ limit: 2 });
      expect(results).toEqual([a1, a2]);
    });

    it('should support combined filters (type + after + limit)', async () => {
      const results = await client.select({
        type: 'typeA',
        after: 'a1',
        limit: 1,
      });
      expect(results).toEqual([a3]);
    });

    it('should return empty list if "after" cursor not found', async () => {
      const results = await client.select({ after: 'non-existent' });
      expect(results).toEqual([]);
    });
  });

  describe('list()', () => {
    it('should delegate to network.listActivities', async () => {
      const mockResponse = {
        activities: [createActivity('a1', '2023-10-26T10:00:00Z')],
        nextPageToken: 'token',
      };
      (networkMock.listActivities as any).mockResolvedValue(mockResponse);

      const options = { pageSize: 10, pageToken: 'prev-token' };
      const result = await client.list(options);

      expect(networkMock.listActivities).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('get()', () => {
    it('should return from storage if found (cache hit)', async () => {
      const cachedActivity = createActivity('a1', '2023-10-26T10:00:00Z');
      storageMock.get = vi.fn().mockResolvedValue(cachedActivity);

      const result = await client.get('a1');

      expect(storageMock.init).toHaveBeenCalledTimes(1);
      expect(storageMock.get).toHaveBeenCalledWith('a1');
      expect(networkMock.fetchActivity).not.toHaveBeenCalled();
      expect(result).toEqual(cachedActivity);
    });

    it('should fetch from network, persist, and return if not in storage (cache miss)', async () => {
      const freshActivity = createActivity('a1', '2023-10-26T10:00:00Z');
      storageMock.get = vi.fn().mockResolvedValue(undefined);
      (networkMock.fetchActivity as any).mockResolvedValue(freshActivity);

      const result = await client.get('a1');

      expect(storageMock.init).toHaveBeenCalledTimes(1);
      expect(storageMock.get).toHaveBeenCalledWith('a1');
      expect(networkMock.fetchActivity).toHaveBeenCalledWith('a1');
      expect(storageMock.append).toHaveBeenCalledWith(freshActivity);
      expect(result).toEqual(freshActivity);
    });
  });
});
