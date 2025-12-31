import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ApiClient } from '../src/api.js';
import { JulesRateLimitError } from '../src/errors.js';

describe('ApiClient 429 Retry', () => {
  let apiClient: ApiClient;
  const baseUrl = 'https://api.jules.com';

  beforeEach(() => {
    vi.useFakeTimers();
    apiClient = new ApiClient({
      apiKey: 'test-key',
      baseUrl,
      requestTimeoutMs: 1000,
    });
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should retry on 429 error with exponential backoff', async () => {
    const fetchMock = global.fetch as any;

    // First 2 calls return 429, 3rd call succeeds
    fetchMock
      .mockResolvedValueOnce(
        new Response('Rate Limit', {
          status: 429,
          statusText: 'Too Many Requests',
        }),
      )
      .mockResolvedValueOnce(
        new Response('Rate Limit', {
          status: 429,
          statusText: 'Too Many Requests',
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"success": true}', { status: 200 }),
      );

    const promise = apiClient.request('test');

    // Fast-forward timers for backoff loops
    // We need to advance time incrementally to trigger each retry
    // First backoff ~1000-1500ms
    await vi.advanceTimersByTimeAsync(1600);
    // Second backoff ~2000-2500ms
    await vi.advanceTimersByTimeAsync(2600);

    const result = await promise;

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should fail after maximum retries', async () => {
    const fetchMock = global.fetch as any;

    // Always return 429
    fetchMock.mockResolvedValue(
      new Response('Rate Limit', {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );

    const promise = apiClient.request('test');

    // Attach expectation before advancing timers to catch the rejection immediately
    const expectation = expect(promise).rejects.toThrow(JulesRateLimitError);

    // Fast-forward enough times
    await vi.advanceTimersByTimeAsync(100000);

    await expectation;
  });
});
