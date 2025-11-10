import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DefaultActivityClient,
  RawNetworkStream,
} from '../../src/activities/client.js';
import { ActivityStorage } from '../../src/storage/types.js';
import { ActivityAgentMessaged } from '../../src/types.js';

// Helper to create dummy activities
const createActivity = (
  id: string,
  createTime: string,
): ActivityAgentMessaged =>
  ({
    name: `sessions/s1/activities/${id}`,
    id,
    type: 'agentMessaged',
    message: `Message ${id}`,
    createTime,
    originator: 'agent',
    artifacts: [],
  }) as ActivityAgentMessaged;

describe('DefaultActivityClient', () => {
  let storageMock: ActivityStorage;
  let networkMock: RawNetworkStream;
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

  describe('Unimplemented methods', () => {
    it('select() should throw Not Implemented', async () => {
      await expect(client.select()).rejects.toThrow(
        "Method 'select()' not yet implemented.",
      );
    });

    it('list() should throw Not Implemented', async () => {
      await expect(client.list()).rejects.toThrow(
        "Method 'list()' not yet implemented.",
      );
    });

    it('get() should throw Not Implemented', async () => {
      await expect(client.get('some-id')).rejects.toThrow(
        "Method 'get()' not yet implemented.",
      );
    });
  });
});
