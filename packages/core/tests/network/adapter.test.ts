import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkAdapter } from '../../src/network/adapter.js';
import { ApiClient } from '../../src/api.js';

// Mock ApiClient
const mockRequest = vi.fn();
vi.mock('../../src/api.js', () => {
  return {
    ApiClient: vi.fn().mockImplementation(() => {
      return {
        request: mockRequest,
      };
    }),
  };
});

function createMockRestActivity(id: string) {
  return {
    name: `sessions/session-123/activities/${id}`,
    createTime: '2023-01-01T00:00:00Z',
    originator: 'system',
    sessionCompleted: {},
  };
}

function createExpectedSdkActivity(id: string) {
  return {
    name: `sessions/session-123/activities/${id}`,
    id: id,
    createTime: '2023-01-01T00:00:00Z',
    originator: 'system',
    artifacts: [],
    type: 'sessionCompleted',
  };
}

import { mockPlatform } from '../mocks/platform.js';

describe('NetworkAdapter', () => {
  let adapter: NetworkAdapter;
  let apiClient: ApiClient;

  beforeEach(() => {
    mockRequest.mockReset();
    apiClient = new ApiClient({
      apiKey: 'test-key',
      baseUrl: 'http://test-url',
      requestTimeoutMs: 1000,
    });
    adapter = new NetworkAdapter(apiClient, 'session-123', 100, mockPlatform); // Short polling interval for tests
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch a single activity', async () => {
    const mockRest = createMockRestActivity('act-1');
    mockRequest.mockResolvedValue(mockRest);

    const result = await adapter.fetchActivity('act-1');

    expect(mockRequest).toHaveBeenCalledWith(
      'sessions/session-123/activities/act-1',
    );
    expect(result).toEqual(createExpectedSdkActivity('act-1'));
  });

  it('should list activities with options', async () => {
    const mockResponse = {
      activities: [
        createMockRestActivity('act-1'),
        createMockRestActivity('act-2'),
      ],
      nextPageToken: 'token-next',
    };
    mockRequest.mockResolvedValue(mockResponse);

    const result = await adapter.listActivities({
      pageSize: 10,
      pageToken: 'token-prev',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'sessions/session-123/activities',
      {
        query: {
          pageSize: '10',
          pageToken: 'token-prev',
        },
      },
    );
    expect(result).toEqual({
      activities: [
        createExpectedSdkActivity('act-1'),
        createExpectedSdkActivity('act-2'),
      ],
      nextPageToken: 'token-next',
    });
  });

  it('should pass filter parameter', async () => {
    mockRequest.mockResolvedValue({});
    await adapter.listActivities({
      filter: 'create_time>"2023-01-01T00:00:00Z"',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'sessions/session-123/activities',
      {
        query: {
          filter: 'create_time>"2023-01-01T00:00:00Z"',
        },
      },
    );
  });

  it('should pass both filter and pageToken', async () => {
    mockRequest.mockResolvedValue({});
    await adapter.listActivities({
      filter: 'create_time>"2023-01-01T00:00:00Z"',
      pageToken: 'token-123',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      'sessions/session-123/activities',
      {
        query: {
          filter: 'create_time>"2023-01-01T00:00:00Z"',
          pageToken: 'token-123',
        },
      },
    );
  });

  it('should handle empty list response', async () => {
    mockRequest.mockResolvedValue({});

    const result = await adapter.listActivities();

    expect(result.activities).toEqual([]);
    expect(result.nextPageToken).toBeUndefined();
  });

  it('should poll in rawStream', async () => {
    // Mock first call: returns one activity, no next page
    mockRequest.mockResolvedValueOnce({
      activities: [createMockRestActivity('act-1')],
    });
    // Mock second call (after poll): returns same activity + new one
    mockRequest.mockResolvedValueOnce({
      activities: [
        createMockRestActivity('act-1'),
        createMockRestActivity('act-2'),
      ],
    });

    const stream = adapter.rawStream();
    const iterator = stream[Symbol.asyncIterator]();

    // First fetch
    let next = await iterator.next();
    expect(next.value).toEqual(createExpectedSdkActivity('act-1'));

    // Should be waiting now.
    // We need to trigger the wait.
    const nextPromise = iterator.next();

    // Advance time to trigger polling
    await vi.advanceTimersByTimeAsync(101);

    next = await nextPromise;
    // Re-fetched 'act-1' because it starts from scratch
    expect(next.value).toEqual(createExpectedSdkActivity('act-1'));

    next = await iterator.next();
    // Newly fetched 'act-2'
    expect(next.value).toEqual(createExpectedSdkActivity('act-2'));
  });

  describe('404 retry logic for eventual consistency', () => {
    it('should retry on 404 for the first request and succeed', async () => {
      const { JulesApiError } = await import('../../src/errors.js');

      // First call: 404
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );
      // Second call (after 1s delay): success
      mockRequest.mockResolvedValueOnce({
        activities: [createMockRestActivity('act-1')],
      });

      const resultPromise = adapter.listActivities();

      // Advance past the 1s retry delay
      await vi.advanceTimersByTimeAsync(1001);

      const result = await resultPromise;
      expect(result.activities).toHaveLength(1);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times on consecutive 404s', async () => {
      const { JulesApiError } = await import('../../src/errors.js');

      // First 3 calls: 404
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );
      // Fourth call: success
      mockRequest.mockResolvedValueOnce({
        activities: [createMockRestActivity('act-1')],
      });

      const resultPromise = adapter.listActivities();

      // Advance past retries: 1s + 2s + 4s = 7s total
      await vi.advanceTimersByTimeAsync(8000);

      const result = await resultPromise;
      expect(result.activities).toHaveLength(1);
      expect(mockRequest).toHaveBeenCalledTimes(4);
    });

    it('should throw after exhausting all retries', async () => {
      const { JulesApiError } = await import('../../src/errors.js');

      // All calls return 404 (initial + 5 retries = 6 calls)
      for (let i = 0; i < 6; i++) {
        mockRequest.mockImplementationOnce(async () => {
          throw new JulesApiError('http://test', 404, 'Not Found');
        });
      }

      const resultPromise = adapter.listActivities();
      const expectPromise =
        expect(resultPromise).rejects.toThrow(JulesApiError);

      // Advance past all retries: 1s + 2s + 4s + 8s + 16s = 31s
      await vi.advanceTimersByTimeAsync(32000);

      await expectPromise;
      expect(mockRequest).toHaveBeenCalledTimes(6);
    });

    it('should not retry after the first successful request', async () => {
      const { JulesApiError } = await import('../../src/errors.js');

      // First call: success
      mockRequest.mockResolvedValueOnce({
        activities: [createMockRestActivity('act-1')],
      });
      // Second call: 404 (should NOT retry)
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );

      // First call succeeds
      const result1 = await adapter.listActivities();
      expect(result1.activities).toHaveLength(1);

      // Second call should throw immediately without retrying
      await expect(adapter.listActivities()).rejects.toThrow(JulesApiError);

      // Only 2 calls total (no retries on second)
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-404 errors', async () => {
      const { JulesApiError } = await import('../../src/errors.js');

      // First call: 500 error (should not retry)
      mockRequest.mockRejectedValueOnce(
        new JulesApiError('http://test', 500, 'Server Error'),
      );

      await expect(adapter.listActivities()).rejects.toThrow(JulesApiError);

      // Only 1 call (no retries for non-404)
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});
