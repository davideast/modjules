import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRClientImpl } from '../../src/github/pr-client.js';
import { GitHubApiClient } from '../../src/github/api.js';

// Hoist the mock function to be available in the mock factory
const { mockIsPRCacheValid } = vi.hoisted(() => {
  return { mockIsPRCacheValid: vi.fn() };
});

// Mock the API client
const mockRequest = vi.fn();
vi.mock('../../src/github/api.js', () => {
  return {
    GitHubApiClient: vi.fn().mockImplementation(() => {
      return {
        request: mockRequest,
      };
    }),
  };
});

// Mock the caching module
vi.mock('../../src/github/caching.js', () => {
  return {
    isPRCacheValid: mockIsPRCacheValid,
  };
});

describe('PRClient', () => {
  let api: GitHubApiClient;
  let prClient: PRClientImpl;
  const owner = 'modjules';
  const repo = 'modjules';
  const number = 42;

  const rawPRData = {
    id: 123,
    number: 42,
    node_id: 'PR_NODE_ID',
    html_url: 'https://github.com/modjules/modjules/pull/42',
    url: 'https://api.github.com/repos/modjules/modjules/pulls/42',
    title: 'Amazing New Feature',
    body: 'This PR does amazing things.',
    state: 'open',
    merged: false,
    draft: false,
    mergeable: true,
    mergeable_state: 'clean',
    base: { ref: 'main', sha: 'base-sha' },
    head: { ref: 'feature-branch', sha: 'head-sha' },
    additions: 100,
    deletions: 10,
    changed_files: 5,
    commits: 3,
    user: { id: 1, login: 'developer', type: 'User', avatar_url: 'avatar-url' },
    assignees: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    merged_at: null,
    closed_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api = new GitHubApiClient('fake-token');
    prClient = new PRClientImpl(api, owner, repo, number);
  });

  it('should fetch PR info from the API when cache is empty', async () => {
    mockRequest.mockResolvedValue(rawPRData);

    const info = await prClient.info();

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith('/repos/modjules/modjules/pulls/42');
    // isPRCacheValid is NOT called when the cache is empty due to short-circuiting
    expect(mockIsPRCacheValid).toHaveBeenCalledTimes(0);
    expect(info.id).toBe(123);
    expect(info.title).toBe('Amazing New Feature');
    expect(info.author.login).toBe('developer');
  });

  it('should return PR info from cache when cache is valid', async () => {
    // Prime the cache by calling info() once.
    mockRequest.mockResolvedValue(rawPRData);
    await prClient.info();

    // Now, set up the scenario for a valid cache hit.
    mockIsPRCacheValid.mockReturnValue(true);
    mockRequest.mockClear();

    const info = await prClient.info();

    // The request should NOT be made again.
    expect(mockRequest).not.toHaveBeenCalled();
    // isPRCacheValid should have been called once on this second call.
    expect(mockIsPRCacheValid).toHaveBeenCalledTimes(1);
    expect(info.id).toBe(123);
  });

  it('should correctly map raw API data to PRResource', async () => {
    mockIsPRCacheValid.mockReturnValue(false);
    mockRequest.mockResolvedValue(rawPRData);

    const resource = await prClient.info();

    expect(resource).toEqual({
      id: 123,
      number: 42,
      nodeId: 'PR_NODE_ID',
      url: 'https://github.com/modjules/modjules/pull/42',
      apiUrl: 'https://api.github.com/repos/modjules/modjules/pulls/42',
      title: 'Amazing New Feature',
      body: 'This PR does amazing things.',
      state: 'open',
      merged: false,
      draft: false,
      mergeable: true,
      mergeableState: 'clean',
      baseRef: 'main',
      headRef: 'feature-branch',
      baseCommitSha: 'base-sha',
      headCommitSha: 'head-sha',
      additions: 100,
      deletions: 10,
      changedFiles: 5,
      commits: 3,
      author: { id: 1, login: 'developer', type: 'User', avatarUrl: 'avatar-url' },
      assignees: [],
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      mergedAt: null,
      closedAt: null,
    });
  });
});
