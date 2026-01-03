import { describe, it, expect, vi, beforeEach } from 'vitest';
import { github } from '../../src/github/adapter.js';
import type { GitHubApiClient } from '../../src/github/api.js';
import { PRClientImpl } from '../../src/github/pr-client.js';

// Mock the PRClientImpl
vi.mock('../../src/github/pr-client.js', () => {
  return {
    PRClientImpl: vi.fn().mockImplementation((api, owner, repo, number) => {
      return { api, owner, repo, number };
    }),
  };
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

describe('GitHubAdapter', () => {
  const config = { token: 'test-token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a PRClient using owner/repo string', () => {
    const adapter = github(config);
    const prClient = adapter.pr('modjules/modjules', 123);
    expect(PRClientImpl).toHaveBeenCalledWith(expect.anything(), 'modjules', 'modjules', 123);
    expect(prClient.owner).toBe('modjules');
    expect(prClient.repo).toBe('modjules');
    expect(prClient.number).toBe(123);
  });

  it('should create a PRClient using an options object', () => {
    const adapter = github(config);
    const prClient = adapter.pr({ owner: 'owner', repo: 'repo', number: 456 });
    expect(PRClientImpl).toHaveBeenCalledWith(expect.anything(), 'owner', 'repo', 456);
    expect(prClient.owner).toBe('owner');
    expect(prClient.repo).toBe('repo');
    expect(prClient.number).toBe(456);
  });

  it('should create a PRClient from a valid URL', () => {
    const adapter = github(config);
    const url = 'https://github.com/test-owner/test-repo/pull/789';
    const prClient = adapter.pr(url);
    expect(PRClientImpl).toHaveBeenCalledWith(expect.anything(), 'test-owner', 'test-repo', 789);
    expect(prClient.owner).toBe('test-owner');
    expect(prClient.repo).toBe('test-repo');
    expect(prClient.number).toBe(789);
  });

  it('should throw an error for an invalid URL', () => {
    const adapter = github(config);
    const url = 'https://example.com/not-a-pr';
    expect(() => adapter.pr(url)).toThrow('Invalid PR URL or repo string.');
  });

  it('should throw an error for an invalid repo string', () => {
    const adapter = github(config);
    expect(() => adapter.pr('invalid-repo', 123)).toThrow('Invalid repo string. Expected format: "owner/repo"');
  });

  describe('parsePrUrl', () => {
    it('should parse a standard GitHub PR URL', () => {
      const adapter = github(config);
      const url = 'https://github.com/owner/repo/pull/123';
      const result = adapter.parsePrUrl(url);
      expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 123 });
    });

    it('should return null for an invalid URL', () => {
      const adapter = github(config);
      const url = 'https://github.com/owner/repo/issues/123';
      const result = adapter.parsePrUrl(url);
      expect(result).toBeNull();
    });
  });

  describe('viewer', () => {
    it('should fetch and map the current user', async () => {
      const rawUser = { id: 1, login: 'jules-bot', type: 'Bot', avatar_url: 'url' };
      mockRequest.mockResolvedValue(rawUser);

      const adapter = github(config);
      const user = await adapter.viewer();

      expect(mockRequest).toHaveBeenCalledWith('/user');
      expect(user).toEqual({ id: 1, login: 'jules-bot', type: 'Bot', avatarUrl: 'url' });
    });
  });

  describe('rateLimit', () => {
    it('should fetch and map the rate limit information', async () => {
      const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const rawRateLimit = {
        rate: {
          limit: 5000,
          remaining: 4999,
          used: 1,
          reset: resetTimestamp,
        },
      };
      mockRequest.mockResolvedValue(rawRateLimit);

      const adapter = github(config);
      const rateLimit = await adapter.rateLimit();

      expect(mockRequest).toHaveBeenCalledWith('/rate_limit');
      expect(rateLimit).toEqual({
        limit: 5000,
        remaining: 4999,
        used: 1,
        reset: new Date(resetTimestamp * 1000),
      });
    });
  });
});
