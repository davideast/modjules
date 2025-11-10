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
    adapter = new NetworkAdapter(apiClient, 'session-123', 100); // Short polling interval for tests
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fetch a single activity', async () => {
    const mockActivity = { id: 'act-1' };
    mockRequest.mockResolvedValue(mockActivity);

    const result = await adapter.fetchActivity('act-1');

    expect(mockRequest).toHaveBeenCalledWith(
      'sessions/session-123/activities/act-1',
    );
    expect(result).toEqual(mockActivity);
  });

  it('should list activities with options', async () => {
    const mockResponse = {
      activities: [{ id: 'act-1' }, { id: 'act-2' }],
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
        params: {
          pageSize: '10',
          pageToken: 'token-prev',
        },
      },
    );
    expect(result).toEqual(mockResponse);
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
      activities: [{ id: 'act-1' }],
    });
    // Mock second call (after poll): returns same activity + new one
    mockRequest.mockResolvedValueOnce({
      activities: [{ id: 'act-1' }, { id: 'act-2' }],
    });

    const stream = adapter.rawStream();
    const iterator = stream[Symbol.asyncIterator]();

    // First fetch
    let next = await iterator.next();
    expect(next.value).toEqual({ id: 'act-1' });

    // Should be waiting now.
    // We need to trigger the wait.
    const nextPromise = iterator.next();

    // Advance time to trigger polling
    await vi.advanceTimersByTimeAsync(101);

    next = await nextPromise;
    // Re-fetched 'act-1' because it starts from scratch
    expect(next.value).toEqual({ id: 'act-1' });

    next = await iterator.next();
    // Newly fetched 'act-2'
    expect(next.value).toEqual({ id: 'act-2' });
  });
});
