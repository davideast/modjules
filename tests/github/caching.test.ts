import { describe, it, expect, beforeEach } from 'vitest';
import { isPRCacheValid } from '../../src/github/caching.js';
import type { CachedPR, PRResource } from '../../src/github/types.js';

describe('isPRCacheValid', () => {
  let now: number;
  let basePR: PRResource;

  beforeEach(() => {
    now = Date.now();
    basePR = {
      id: 1,
      number: 1,
      nodeId: 'PR_kwDOKVb1_85d-q7P',
      url: 'https://github.com/modjules/modjules/pull/1',
      apiUrl: 'https://api.github.com/repos/modjules/modjules/pulls/1',
      title: 'feat: Initial commit',
      body: '',
      state: 'open',
      merged: false,
      draft: false,
      mergeable: true,
      mergeableState: 'clean',
      baseRef: 'main',
      headRef: 'feature',
      baseCommitSha: 'sha-base',
      headCommitSha: 'sha-head',
      additions: 10,
      deletions: 2,
      changedFiles: 3,
      commits: 1,
      author: { id: 1, login: 'test-user', type: 'User' },
      assignees: [],
      createdAt: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
      updatedAt: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
      mergedAt: null,
      closedAt: null,
    };
  });

  it('should return false for an undefined cache entry', () => {
    expect(isPRCacheValid(undefined, now)).toBe(false);
  });

  // --- HOT ---
  it('should be valid for an open PR synced 10 seconds ago', () => {
    const cached: CachedPR = {
      resource: basePR,
      _lastSyncedAt: now - 10 * 1000,
    };
    expect(isPRCacheValid(cached, now)).toBe(true);
  });

  it('should be invalid for an open PR synced 45 seconds ago', () => {
    const cached: CachedPR = {
      resource: basePR,
      _lastSyncedAt: now - 45 * 1000,
    };
    expect(isPRCacheValid(cached, now)).toBe(false);
  });

  // --- WARM ---
  it('should be valid for a recently merged PR synced 1 minute ago', () => {
    const pr: PRResource = {
      ...basePR,
      state: 'closed',
      merged: true,
      mergedAt: new Date(now - 2 * 60 * 1000), // 2 minutes ago
    };
    const cached: CachedPR = {
      resource: pr,
      _lastSyncedAt: now - 60 * 1000,
    };
    expect(isPRCacheValid(cached, now)).toBe(true);
  });

  it('should be invalid for a recently merged PR synced 6 minutes ago', () => {
    const pr: PRResource = {
      ...basePR,
      state: 'closed',
      merged: true,
      mergedAt: new Date(now - 10 * 60 * 1000), // 10 minutes ago
    };
    const cached: CachedPR = {
      resource: pr,
      _lastSyncedAt: now - 6 * 60 * 1000,
    };
    expect(isPRCacheValid(cached, now)).toBe(false);
  });

  // --- FROZEN ---
  it('should be valid for a merged PR from 2 days ago, regardless of sync time', () => {
    const pr: PRResource = {
      ...basePR,
      state: 'closed',
      merged: true,
      mergedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
    };
    const cached: CachedPR = {
      resource: pr,
      _lastSyncedAt: now - 1 * 24 * 60 * 60 * 1000, // Synced yesterday
    };
    expect(isPRCacheValid(cached, now)).toBe(true);
  });

  it('should be valid for a closed (unmerged) PR from 8 days ago', () => {
    const pr: PRResource = {
      ...basePR,
      state: 'closed',
      merged: false,
      closedAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
    };
    const cached: CachedPR = {
      resource: pr,
      _lastSyncedAt: now - 1 * 24 * 60 * 60 * 1000,
    };
    expect(isPRCacheValid(cached, now)).toBe(true);
  });
});
