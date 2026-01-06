import { SessionResource } from './types.js';
import { CachedSession } from './storage/types.js';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type CacheTier = 'hot' | 'warm' | 'frozen';

/**
 * Determines the cache tier for a session based on its state and age.
 *
 * Strategy:
 * - **Frozen (Tier 3):** > 30 days old. Immutable.
 * - **Warm (Tier 2):** Terminal state + Verified < 24h ago. High read performance.
 * - **Hot (Tier 1):** Active or Stale. Requires network sync.
 */
export function determineCacheTier(
  cached: CachedSession,
  now: number = Date.now(),
): CacheTier {
  const createdAt = new Date(cached.resource.createTime).getTime();
  const age = now - createdAt;
  const isTerminal = ['failed', 'completed'].includes(cached.resource.state);

  // TIER 3: FROZEN (Older than 1 month)
  if (age > ONE_MONTH_MS) {
    return 'frozen';
  }

  // TIER 2: WARM (Terminal state + synced recently)
  const timeSinceSync = now - cached._lastSyncedAt;
  if (isTerminal && timeSinceSync < ONE_DAY_MS) {
    return 'warm';
  }

  // TIER 1: HOT
  return 'hot';
}

/**
 * Helper to check if a cached session is valid to return immediately.
 * Returns true if the session is Frozen or Warm.
 */
export function isCacheValid(
  cached: CachedSession | undefined,
  now: number = Date.now(),
): cached is CachedSession {
  if (!cached) return false;
  const tier = determineCacheTier(cached, now);
  return tier === 'frozen' || tier === 'warm';
}
