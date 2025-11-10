import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkAdapter } from '../../src/network/adapter.js';
import { ApiClient } from '../../src/api.js';

// Mock ApiClient
const apiClientMock = {
  request: vi.fn(),
} as unknown as ApiClient;

describe('NetworkAdapter', () => {
  let adapter: NetworkAdapter;
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.resetAllMocks();
    // Use a small polling interval for tests to run fast
    adapter = new NetworkAdapter(apiClientMock, sessionId, 100); // 100ms
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchActivity', () => {
    it('should call apiClient.request with correct URL', async () => {
      const activityId = 'act-123';
      const mockActivity = { id: activityId };
      (apiClientMock.request as any).mockResolvedValue(mockActivity);

      const result = await adapter.fetchActivity(activityId);

      expect(apiClientMock.request).toHaveBeenCalledWith(
        `sessions/${sessionId}/activities/${activityId}`,
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('listActivities', () => {
    it('should call apiClient.request with correct URL and no params if no options', async () => {
      const mockResponse = { activities: [] };
      (apiClientMock.request as any).mockResolvedValue(mockResponse);

      const result = await adapter.listActivities();

      expect(apiClientMock.request).toHaveBeenCalledWith(
        `sessions/${sessionId}/activities`,
        { params: {} },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should map options to query params', async () => {
      const mockResponse = { activities: [] };
      (apiClientMock.request as any).mockResolvedValue(mockResponse);

      await adapter.listActivities({ pageSize: 10, pageToken: 'token123' });

      expect(apiClientMock.request).toHaveBeenCalledWith(
        `sessions/${sessionId}/activities`,
        {
          params: {
            pageSize: '10',
            pageToken: 'token123',
          },
        },
      );
    });
  });

  describe('rawStream', () => {
    it('should yield activities from multiple pages and then poll from scratch', async () => {
      const page1 = {
        activities: [{ id: 'a1' }, { id: 'a2' }],
        nextPageToken: 'token2',
      };
      const page2 = {
        activities: [{ id: 'a3' }],
        // No nextPageToken, will trigger polling wait
      };
      const page1Reloaded = {
        activities: [{ id: 'a1_reloaded' }], // Changed ID to verify it's a new fetch
      };

      let callCount = 0;
      (apiClientMock.request as any).mockImplementation(
        async (url: string, options: any) => {
          callCount++;
          if (callCount === 1) {
            // First call, no token
            expect(options.params.pageToken).toBeUndefined();
            return page1;
          }
          if (callCount === 2) {
            // Second call, token2
            expect(options.params.pageToken).toBe('token2');
            return page2;
          }
          if (callCount === 3) {
            // Third call, after polling wait, should be back to no token
            expect(options.params.pageToken).toBeUndefined();
            return page1Reloaded;
          }
          // Hang forever after this to stop the test from looping nicely if we wanted
          return new Promise(() => {});
        },
      );

      const stream = adapter.rawStream();
      const iterator = stream[Symbol.asyncIterator]();

      // Page 1
      expect((await iterator.next()).value).toEqual({ id: 'a1' });
      expect((await iterator.next()).value).toEqual({ id: 'a2' });

      // Page 2
      expect((await iterator.next()).value).toEqual({ id: 'a3' });

      // Now it should be waiting.
      const nextPromise = iterator.next();

      // Advance time to trigger the sleep to finish
      await vi.advanceTimersByTimeAsync(200);

      // Should have re-fetched page 1 from scratch
      expect((await nextPromise).value).toEqual({ id: 'a1_reloaded' });

      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });
});
