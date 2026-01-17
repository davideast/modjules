import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withFirstRequestRetry } from '../src/retry-utils.js';
import { JulesApiError } from '../src/errors.js';

describe('withFirstRequestRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the result on success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withFirstRequestRetry(fn);
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 404 and succeed on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockResolvedValueOnce('success after retry');

    const resultPromise = withFirstRequestRetry(fn);

    // Advance past the 1s retry delay
    await vi.advanceTimersByTimeAsync(1001);

    const result = await resultPromise;
    expect(result).toBe('success after retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry multiple times with exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockResolvedValueOnce('success after 3 retries');

    const resultPromise = withFirstRequestRetry(fn);

    // Advance past all delays: 1s + 2s + 4s = 7s total
    await vi.advanceTimersByTimeAsync(8000);

    const result = await resultPromise;
    expect(result).toBe('success after 3 retries');
    expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should throw after exhausting all retries', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new JulesApiError('http://test', 404, 'Not Found'));

    const resultPromise = withFirstRequestRetry(fn);

    // Advance past all delays: 1s + 2s + 4s + 8s + 16s = 31s
    await vi.advanceTimersByTimeAsync(32000);

    await expect(resultPromise).rejects.toThrow(JulesApiError);
    expect(fn).toHaveBeenCalledTimes(6); // Initial + 5 retries
  });

  it('should throw immediately on non-404 errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new JulesApiError('http://test', 500, 'Server Error'));

    await expect(withFirstRequestRetry(fn)).rejects.toThrow(JulesApiError);

    // Only 1 call, no retries
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw non-404 error during retry immediately', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockRejectedValueOnce(
        new JulesApiError('http://test', 500, 'Server Error'),
      );

    const resultPromise = withFirstRequestRetry(fn);

    // Advance past the first retry delay
    await vi.advanceTimersByTimeAsync(1001);

    await expect(resultPromise).rejects.toThrow(JulesApiError);

    // 2 calls: initial 404, then 500 (stopped retrying)
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should support custom retry options', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new JulesApiError('http://test', 404, 'Not Found'))
      .mockRejectedValueOnce(
        new JulesApiError('http://test', 404, 'Not Found'),
      );

    // Only allow 1 retry with 100ms initial delay
    const resultPromise = withFirstRequestRetry(fn, {
      maxRetries: 1,
      initialDelayMs: 100,
    });

    // Advance past both delays
    await vi.advanceTimersByTimeAsync(500);

    await expect(resultPromise).rejects.toThrow(JulesApiError);

    // Initial + 1 retry = 2 calls
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
