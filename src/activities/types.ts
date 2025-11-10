import { Activity } from '../types.js';

// Define standard pagination options for the honest network list()
export interface ListOptions {
  pageSize?: number;
  pageToken?: string;
}

// Define rich query options for local select()
export interface SelectOptions {
  after?: string; // Activity ID
  before?: string; // Activity ID
  type?: string; // Activity Type
  limit?: number;
}

export interface ActivityClient {
  /**
   * COLD STREAM: Yields all known past activities from local storage.
   * Ends immediately after yielding the last known activity.
   * Does NOT open a network connection.
   */
  history(): AsyncIterable<Activity>;

  /**
   * HOT STREAM: Yields ONLY future activities as they arrive from the network.
   * Blocks indefinitely.
   */
  updates(): AsyncIterable<Activity>;

  /**
   * HYBRID STREAM: Yields full history(), then seamlessly switches to updates().
   * The standard choice for most applications.
   */
  stream(): AsyncIterable<Activity>;

  /**
   * LOCAL QUERY: Performs rich filtering against local storage only.
   * Fast, but might be incomplete if not synced.
   */
  select(options?: SelectOptions): Promise<Activity[]>;

  /**
   * NETWORK LIST: Honest wrapper around standard REST pagination.
   * Uses opaque tokens.
   */
  list(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }>;

  /**
   * NETWORK GET: Fetches a specific activity from the network and caches it.
   */
  get(activityId: string): Promise<Activity>;
}
