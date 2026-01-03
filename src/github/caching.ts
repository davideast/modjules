import type { CachedPR } from './types.js';

export function isPRCacheValid(cached: CachedPR | undefined, now: number = Date.now()): boolean {
  if (!cached) return false;

  const age = now - cached._lastSyncedAt;
  const pr = cached.resource;

  // FROZEN: Merged PRs older than 24 hours never change
  if (pr.merged && pr.mergedAt) {
    const timeSinceMerge = now - new Date(pr.mergedAt).getTime();
    if (timeSinceMerge > 24 * 60 * 60 * 1000) {
      return true; // Always valid
    }
  }

  // FROZEN: Closed (not merged) PRs older than 7 days
  if (pr.state === 'closed' && !pr.merged && pr.closedAt) {
    const timeSinceClose = now - new Date(pr.closedAt).getTime();
    if (timeSinceClose > 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
  }

  // WARM: Recently closed/merged PRs - 5 minute TTL
  if (pr.state === 'closed' || pr.merged) {
    return age < 5 * 60 * 1000;
  }

  // HOT: Open PRs - 30 second TTL
  return age < 30 * 1000;
}
