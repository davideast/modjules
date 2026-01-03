import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { github } from '../../src/github/adapter.js';
import type { GitHubAdapter } from '../../src/github/types.js';

// Mock PR data
const createMockPRResponse = (overrides = {}) => ({
  id: 1,
  number: 1,
  node_id: 'PR_1',
  html_url: 'https://github.com/owner/repo/pull/1',
  url: 'https://api.github.com/repos/owner/repo/pulls/1',
  title: 'Test PR',
  body: 'Test body',
  state: 'open',
  merged: false,
  draft: false,
  mergeable: true,
  mergeable_state: 'clean',
  base: { ref: 'main', sha: 'base-sha' },
  head: { ref: 'feature', sha: 'head-sha' },
  additions: 10,
  deletions: 5,
  changed_files: 2,
  commits: 1,
  user: {
    id: 1,
    login: 'testuser',
    type: 'User',
    avatar_url: 'https://avatar.url',
  },
  assignees: [],
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  merged_at: null,
  closed_at: null,
  ...overrides,
});

describe('GitHub Caching - Spec Tests', () => {
  let adapter: GitHubAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;
  let responses: Response[];

  beforeEach(() => {
    // 1. Enable fake timers FIRST
    vi.useFakeTimers();

    // 2. Set a fixed system time
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));

    // 3. Reset responses
    responses = [];

    // 4. Create a fetch mock that returns queued responses
    fetchMock = vi.fn().mockImplementation(async () => {
      const response = responses.shift();
      if (!response) {
        // Return a default 404 if no responses are queued, to avoid test errors
        return new Response(
          JSON.stringify({ message: 'No more queued responses' }),
          { status: 404 },
        );
      }
      return response;
    });

    // 5. Stub fetch globally
    vi.stubGlobal('fetch', fetchMock);

    // 6. Create adapter AFTER fake timers are set up
    adapter = github({ token: 'test-token' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Helper to queue a mock response
  const queueResponse = (data: any, status = 200) => {
    const responseBody = JSON.stringify(data);
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Content-Length': String(new TextEncoder().encode(responseBody).length),
    });

    const response = new Response(responseBody, {
      status,
      statusText: 'OK',
      headers,
    });

    // Cloning the response to make it reusable in the mock queue if needed
    Object.defineProperty(response, 'clone', {
      value: () => {
        const newResponse = new Response(responseBody, { status, headers });
        return newResponse;
      },
    });

    responses.push(response);
  };

  it('[CAC-01b] HOT Cache - Open PRs cache is invalid if called after 30 seconds', async () => {
    // GIVEN: Two responses queued for the same endpoint
    queueResponse(createMockPRResponse());
    queueResponse(createMockPRResponse({ title: 'Updated PR' }));

    const prClient = adapter.pr({ owner: 'owner', repo: 'repo', number: 1 });

    // WHEN: First call to prime the cache
    const result1 = await prClient.info();
    expect(result1.title).toBe('Test PR');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time by 35 seconds (past the 30s HOT TTL)
    await vi.advanceTimersByTimeAsync(35 * 1000);

    // Second call - cache should be expired
    const result2 = await prClient.info();

    // THEN: Should have made 2 fetch calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result2.title).toBe('Updated PR');
  });

  it('[CAC-01a] HOT Cache - Open PRs cache is valid within 30 seconds', async () => {
    // GIVEN: Only one response needed (second call should use cache)
    queueResponse(createMockPRResponse());

    const prClient = adapter.pr({ owner: 'owner', repo: 'repo', number: 1 });

    // WHEN: First call
    await prClient.info();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance time by only 10 seconds (within 30s TTL)
    await vi.advanceTimersByTimeAsync(10 * 1000);

    // Second call - should use cache
    await prClient.info();

    // THEN: Should still be just 1 fetch call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
