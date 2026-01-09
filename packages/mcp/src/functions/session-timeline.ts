import type { JulesClient } from 'modjules';
import type {
  TimelineResult,
  TimelineOptions,
  LightweightActivity,
} from './types.js';
import { toLightweight } from '../lightweight.js';

/**
 * Get paginated timeline of activities for a session.
 *
 * @param client - The Jules client instance
 * @param sessionId - The session ID to query
 * @param options - Pagination and filtering options
 * @returns Timeline with activities, hasMore flag, and optional cursor
 */
export async function getSessionTimeline(
  client: JulesClient,
  sessionId: string,
  options: TimelineOptions = {},
): Promise<TimelineResult> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const limit = options.limit || 10;
  const order = options.order || 'desc';
  const startAfter = options.startAfter;
  const typeFilter = options.type;

  const session = client.session(sessionId);

  // Hydrate cache from API before querying
  await session.activities.hydrate();

  const activities = await session.activities.select({
    order,
    after: startAfter,
    limit: limit + 1, // Fetch one extra to determine hasMore
    type: typeFilter,
  });

  const hasMore = activities.length > limit;
  const results = activities.slice(0, limit);
  const lightweight = results.map((a) =>
    toLightweight(a),
  ) as LightweightActivity[];

  return {
    activities: lightweight,
    hasMore,
    ...(hasMore &&
      results.length > 0 && {
        nextCursor: results[results.length - 1].id,
      }),
  };
}
