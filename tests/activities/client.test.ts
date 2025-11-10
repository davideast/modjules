import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultActivityClient } from '../../src/activities/client.js';
import { ActivityStorage } from '../../src/storage/types.js';
import { Activity, ActivityAgentMessaged } from '../../src/types.js';

describe('DefaultActivityClient', () => {
  let storageMock: ActivityStorage;
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
    client = new DefaultActivityClient(storageMock);
  });

  describe('history()', () => {
    it('should initialize storage and yield activities from storage.scan()', async () => {
      const mockActivities: Activity[] = [
        {
          name: 'sessions/s1/activities/a1',
          id: 'a1',
          type: 'agentMessaged',
          message: 'Hello',
          createTime: '2023-10-26T10:00:00Z',
          originator: 'agent',
          artifacts: [],
        } as ActivityAgentMessaged,
        {
          name: 'sessions/s1/activities/a2',
          id: 'a2',
          type: 'agentMessaged',
          message: 'World',
          createTime: '2023-10-26T10:01:00Z',
          originator: 'agent',
          artifacts: [],
        } as ActivityAgentMessaged,
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

    it('should yield nothing if storage is empty', async () => {
      storageMock.scan = vi.fn().mockImplementation(async function* () {
        yield* [];
      });

      const result = [];
      for await (const activity of client.history()) {
        result.push(activity);
      }

      expect(storageMock.init).toHaveBeenCalledTimes(1);
      expect(storageMock.scan).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });
  });

  describe('Unimplemented methods', () => {
    it('updates() should throw Not Implemented', async () => {
      const iterator = client.updates()[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow(
        "Method 'updates()' not yet implemented.",
      );
    });

    it('stream() should throw Not Implemented', async () => {
      const iterator = client.stream()[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow(
        "Method 'stream()' not yet implemented.",
      );
    });

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
