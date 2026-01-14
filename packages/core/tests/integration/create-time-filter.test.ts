import { describe, it, expect, beforeAll } from 'vitest';
import {
  DefaultActivityClient,
  NetworkClient,
} from '../../src/activities/client.js';
import { MemoryStorage } from '../../src/storage/memory.js';
import { Activity } from '../../src/types.js';

/**
 * Integration test to verify the create_time filter behavior.
 *
 * This test validates that:
 * 1. When cache is empty, no filter is passed (fetches all activities)
 * 2. When cache has activities, a filter is constructed from the latest createTime
 * 3. The filter format matches the API expectation: create_time>"ISO_TIMESTAMP"
 * 4. Pagination still works correctly with filter (filter + pageToken)
 */
describe('create_time filter integration', () => {
  function createTestActivity(id: string, createTime: string): Activity {
    return {
      name: `sessions/test-session/activities/${id}`,
      id,
      createTime,
      type: 'agentMessaged',
      originator: 'agent',
      message: 'test message',
      artifacts: [],
    } as Activity;
  }

  describe('filter construction', () => {
    it('should NOT use filter when cache is empty (fetch all)', async () => {
      const storage = new MemoryStorage();
      const calls: Array<{ filter?: string; pageToken?: string }> = [];

      const mockNetwork: NetworkClient = {
        async *rawStream() {},
        async listActivities(options) {
          calls.push({
            filter: options?.filter,
            pageToken: options?.pageToken,
          });
          return { activities: [], nextPageToken: undefined };
        },
        async fetchActivity(id) {
          return createTestActivity(id, new Date().toISOString());
        },
      };

      const client = new DefaultActivityClient(storage, mockNetwork);
      await client.hydrate();

      expect(calls.length).toBe(1);
      expect(calls[0].filter).toBeUndefined();
      expect(calls[0].pageToken).toBeUndefined();
    });

    it('should use filter with latest createTime when cache has activities', async () => {
      const storage = new MemoryStorage();
      await storage.init();

      // Pre-populate cache with an activity
      const cachedTime = '2026-01-10T10:00:00.000000Z';
      await storage.append(createTestActivity('cached-1', cachedTime));

      const calls: Array<{ filter?: string; pageToken?: string }> = [];

      const mockNetwork: NetworkClient = {
        async *rawStream() {},
        async listActivities(options) {
          calls.push({
            filter: options?.filter,
            pageToken: options?.pageToken,
          });
          return { activities: [], nextPageToken: undefined };
        },
        async fetchActivity(id) {
          return createTestActivity(id, new Date().toISOString());
        },
      };

      const client = new DefaultActivityClient(storage, mockNetwork);
      await client.hydrate();

      expect(calls.length).toBe(1);
      expect(calls[0].filter).toBe(`create_time>"${cachedTime}"`);
      expect(calls[0].pageToken).toBeUndefined(); // First call has no pageToken
    });

    it('should use filter format matching API expectation', async () => {
      const storage = new MemoryStorage();
      await storage.init();

      const timestamp = '2026-01-12T15:30:45.123456Z';
      await storage.append(createTestActivity('act-1', timestamp));

      let capturedFilter: string | undefined;

      const mockNetwork: NetworkClient = {
        async *rawStream() {},
        async listActivities(options) {
          capturedFilter = options?.filter;
          return { activities: [], nextPageToken: undefined };
        },
        async fetchActivity(id) {
          return createTestActivity(id, new Date().toISOString());
        },
      };

      const client = new DefaultActivityClient(storage, mockNetwork);
      await client.hydrate();

      // Verify format matches API expectation: create_time>"ISO_TIMESTAMP"
      expect(capturedFilter).toMatch(/^create_time>"[^"]+"$/);
      expect(capturedFilter).toBe(`create_time>"${timestamp}"`);
    });

    it('should combine filter with pageToken for pagination', async () => {
      const storage = new MemoryStorage();
      await storage.init();

      const cachedTime = '2026-01-10T10:00:00.000000Z';
      await storage.append(createTestActivity('cached-1', cachedTime));

      const calls: Array<{ filter?: string; pageToken?: string }> = [];
      let callCount = 0;

      const mockNetwork: NetworkClient = {
        async *rawStream() {},
        async listActivities(options) {
          calls.push({
            filter: options?.filter,
            pageToken: options?.pageToken,
          });
          callCount++;

          // First page returns activity and a nextPageToken
          if (callCount === 1) {
            return {
              activities: [
                createTestActivity('new-1', '2026-01-11T10:00:00.000000Z'),
              ],
              nextPageToken: 'page-2-token',
            };
          }

          // Second page returns more activities, no more pages
          return {
            activities: [
              createTestActivity('new-2', '2026-01-12T10:00:00.000000Z'),
            ],
            nextPageToken: undefined,
          };
        },
        async fetchActivity(id) {
          return createTestActivity(id, new Date().toISOString());
        },
      };

      const client = new DefaultActivityClient(storage, mockNetwork);
      const syncedCount = await client.hydrate();

      // Should have made 2 calls (2 pages)
      expect(calls.length).toBe(2);

      // First call: filter, no pageToken
      expect(calls[0].filter).toBe(`create_time>"${cachedTime}"`);
      expect(calls[0].pageToken).toBeUndefined();

      // Second call: same filter, with pageToken from first response
      expect(calls[1].filter).toBe(`create_time>"${cachedTime}"`);
      expect(calls[1].pageToken).toBe('page-2-token');

      // Should have synced 2 new activities
      expect(syncedCount).toBe(2);
    });
  });

  describe('incremental sync behavior', () => {
    it('should only sync activities newer than cached latest', async () => {
      const storage = new MemoryStorage();
      await storage.init();

      // Cache has activity from Jan 10
      const cachedTime = '2026-01-10T10:00:00.000000Z';
      await storage.append(createTestActivity('cached-1', cachedTime));

      const apiActivities = [
        // These are "newer" activities that should be synced
        createTestActivity('new-1', '2026-01-11T10:00:00.000000Z'),
        createTestActivity('new-2', '2026-01-12T10:00:00.000000Z'),
      ];

      const mockNetwork: NetworkClient = {
        async *rawStream() {},
        async listActivities() {
          return { activities: apiActivities, nextPageToken: undefined };
        },
        async fetchActivity(id) {
          return apiActivities.find((a) => a.id === id)!;
        },
      };

      const client = new DefaultActivityClient(storage, mockNetwork);
      const syncedCount = await client.hydrate();

      expect(syncedCount).toBe(2);

      // Verify storage now has all 3 activities
      const allActivities: Activity[] = [];
      for await (const act of storage.scan()) {
        allActivities.push(act);
      }
      expect(allActivities.length).toBe(3);
    });
  });
});
