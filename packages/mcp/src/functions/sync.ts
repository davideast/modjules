import type { JulesClient, SyncDepth } from 'modjules';
import type { SyncOptions, SyncResult } from './types.js';

/**
 * Sync sessions and activities from the Jules API to local cache.
 *
 * @param client - The Jules client instance
 * @param options - Sync options (sessionId, depth)
 * @returns Sync statistics including counts of new items
 */
export async function sync(
  client: JulesClient,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const depth = (options.depth as SyncDepth) || 'metadata';

  return client.sync({
    sessionId: options.sessionId,
    depth,
  });
}
