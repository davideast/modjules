/**
 * Utilities for constructing and parsing Jules API pageTokens.
 *
 * The Jules API uses nanosecond timestamps as pageTokens for activity pagination.
 * This allows us to construct tokens from cached activity createTimes,
 * enabling efficient incremental syncing without re-downloading existing activities.
 *
 * @module
 */

/**
 * Converts an activity's createTime to a Jules API pageToken.
 *
 * The pageToken is the createTime represented as nanoseconds since Unix epoch.
 * By default, adds 1 nanosecond to make it exclusive (returns activities AFTER this time).
 *
 * @param createTime - RFC 3339 timestamp (e.g., "2024-01-05T10:05:00.999999Z")
 * @param exclusive - If true (default), adds 1ns to exclude the activity at this exact time
 * @returns The pageToken string (nanosecond timestamp)
 *
 * @example
 * ```typescript
 * const token = createTimeToPageToken("2024-01-05T10:05:00.999999Z");
 * // Returns "1704448500999999001" (exclusive - activities after this time)
 *
 * const inclusiveToken = createTimeToPageToken("2024-01-05T10:05:00.999999Z", false);
 * // Returns "1704448500999999000" (inclusive - activities at or after this time)
 * ```
 */
export function createTimeToPageToken(
  createTime: string,
  exclusive = true,
): string {
  const date = new Date(createTime);
  const epochMs = date.getTime();

  // Extract sub-millisecond precision from the timestamp
  // Format: "2024-01-05T10:05:00.999999Z" → extract "999999"
  const match = createTime.match(/\.(\d+)Z$/);
  const fractional = match ? match[1].padEnd(9, '0').slice(0, 9) : '000000000';

  // Convert to nanoseconds:
  // - epochMs * 1,000,000 gives nanoseconds from milliseconds
  // - Add the sub-millisecond portion (microseconds → nanoseconds)
  const epochNs =
    BigInt(epochMs) * 1000000n + BigInt(fractional.slice(3, 9)) * 1000n;

  // Add 1 nanosecond for exclusive queries (get activities AFTER this time)
  const token = exclusive ? epochNs + 1n : epochNs;

  return token.toString();
}

/**
 * Converts a Jules API pageToken back to a Date.
 * Useful for debugging and logging.
 *
 * @param token - The pageToken string (nanosecond timestamp)
 * @returns The corresponding Date object
 *
 * @example
 * ```typescript
 * const date = pageTokenToDate("1704448500999999000");
 * // Returns Date for 2024-01-05T10:05:00.999Z
 * ```
 */
export function pageTokenToDate(token: string): Date {
  const tokenNs = BigInt(token);
  const tokenMs = Number(tokenNs / 1000000n);
  return new Date(tokenMs);
}

/**
 * Checks if a session's activities are "frozen" (no new activities possible).
 * A session is considered frozen if its last activity is older than the threshold.
 *
 * @param lastActivityCreateTime - The createTime of the most recent activity
 * @param thresholdDays - Number of days after which a session is frozen (default: 30)
 * @returns true if the session is frozen and no API call is needed
 *
 * @example
 * ```typescript
 * const isFrozen = isSessionFrozen("2024-01-05T10:05:00Z");
 * if (isFrozen) {
 *   // Skip API call - no new activities will ever appear
 * }
 * ```
 */
export function isSessionFrozen(
  lastActivityCreateTime: string,
  thresholdDays = 30,
): boolean {
  const lastActivity = new Date(lastActivityCreateTime);
  const now = new Date();
  const ageMs = now.getTime() - lastActivity.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > thresholdDays;
}
