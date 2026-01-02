import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ApiClient } from '../src/api.js';
import { JulesRateLimitError } from '../src/errors.js';

describe('ApiClient 429 Retry Logic', () => {
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

  it('should retry once after 1s delay if 429 is returned once', async () => {
    const fetchMock = global.fetch as any;

    fetchMock
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

    // 1. Initial request fails immediately.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2. Advance time by 999ms. Retry should NOT happen yet.
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3. Advance time by 1ms (Total 1000ms). Retry should happen.
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const result = await promise;
    expect(result).toEqual({ success: true });
  });

  it('should retry twice (1s, 2s) if 429 is returned twice', async () => {
    const fetchMock = global.fetch as any;

    fetchMock
      .mockResolvedValueOnce(new Response('429', { status: 429 }))
      .mockResolvedValueOnce(new Response('429', { status: 429 }))
      .mockResolvedValueOnce(
        new Response('{"success": true}', { status: 200 }),
      );

    const promise = apiClient.request('test');

    // Attempt 1: Immediate
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Wait 1s (Backoff 1) -> Attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Wait 2s (Backoff 2) -> Attempt 3
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toEqual({ success: true });
  });

  it('should retry three times (1s, 2s, 4s) if 429 is returned three times', async () => {
    const fetchMock = global.fetch as any;

    fetchMock
      .mockResolvedValueOnce(new Response('429', { status: 429 })) // 1
      .mockResolvedValueOnce(new Response('429', { status: 429 })) // 2
      .mockResolvedValueOnce(new Response('429', { status: 429 })) // 3
      .mockResolvedValueOnce(
        new Response('{"success": true}', { status: 200 }),
      ); // 4 (Success)

    const promise = apiClient.request('test');

    // Attempt 1: Immediate
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Wait 1s -> Attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Wait 2s -> Attempt 3
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Wait 4s -> Attempt 4
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await expect(promise).resolves.toEqual({ success: true });
  });

  it('should FAIL after 3 retries (total 4 attempts) if 429 persists', async () => {
    const fetchMock = global.fetch as any;

    // Always 429
    fetchMock.mockResolvedValue(
      new Response('429', { status: 429, statusText: 'Go Away' }),
    );

    const promise = apiClient.request('test');

    // We attach the expectation immediately to prevent "Unhandled Rejection" warnings
    // caused by the promise rejecting during the timer advances.
    const failureExpectation =
      expect(promise).rejects.toThrow(JulesRateLimitError);

    // Attempt 1
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Wait 1s -> Attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Wait 2s -> Attempt 3
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Wait 4s -> Attempt 4 (Final)
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // After this, it should throw, NOT retry again.
    // Even if we wait longer...
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(4); // No more calls

    await failureExpectation;
  });
});
