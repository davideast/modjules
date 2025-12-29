import { Activity } from '../types.js';
import { ActivityStorage } from '../storage/types.js';
import { ActivityClient, ListOptions, SelectOptions } from './types.js';

/**
 * Interface for the network layer used by the activity client.
 * Abstracts away the details of polling and fetching from the API.
 * @internal
 */
export interface NetworkClient {
  rawStream(): AsyncIterable<Activity>;
  listActivities(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }>;
  fetchActivity(activityId: string): Promise<Activity>;
}

/**
 * The default implementation of the ActivityClient.
 * Implements a "local-first" architecture where activities are fetched from
 * the network, cached locally, and then served from the cache.
 */
export class DefaultActivityClient implements ActivityClient {
  constructor(
    private storage: ActivityStorage,
    private network: NetworkClient,
  ) {}

  /**
   * Returns an async iterable of all activities stored locally.
   */
  async *history(): AsyncIterable<Activity> {
    // Ensure storage is ready before we start yielding
    await this.storage.init();

    // Check if cache has any activities
    const hasCache = (await this.storage.latest()) !== undefined;

    // If cache is empty, populate from network
    if (!hasCache) {
      yield* this.fetchAndCacheAll();
      return;
    }

    // Idiomatic delegation to the storage's generator.
    // This yields every item from storage.scan() one by one.
    yield* this.storage.scan();
  }

  /**
   * Fetches all activities from the network and caches them.
   * Used to populate an empty cache.
   * @internal
   */
  private async *fetchAndCacheAll(): AsyncIterable<Activity> {
    let pageToken: string | undefined;

    do {
      const response = await this.network.listActivities({ pageToken });

      for (const activity of response.activities) {
        await this.storage.append(activity);
        yield activity;
      }

      pageToken = response.nextPageToken;
    } while (pageToken);
  }

  /**
   * Forces a full sync of activities from the network to local cache.
   * Useful when you suspect the cache is stale.
   *
   * @returns The number of activities synced.
   */
  async hydrate(): Promise<number> {
    await this.storage.init();

    let count = 0;
    let pageToken: string | undefined;

    const existingIds = new Set<string>();

    for await (const act of this.storage.scan()) {
      existingIds.add(act.id);
    }

    do {
      const response = await this.network.listActivities({ pageToken });

      for (const activity of response.activities) {
        if (!existingIds.has(activity.id)) {
          await this.storage.append(activity);
          existingIds.add(activity.id);
          count++;
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return count;
  }

  /**
   * Returns an async iterable of new activities from the network.
   * This method polls the network and updates the local storage.
   *
   * **Side Effects:**
   * - Polls the network continuously.
   * - Appends new activities to local storage (write-through caching).
   *
   * **Logic:**
   * - Reads the latest activity from storage to determine the "high-water mark".
   * - Ignores incoming activities older than or equal to the high-water mark.
   */
  async *updates(): AsyncIterable<Activity> {
    await this.storage.init();

    // 1. Establish High-Water Mark
    // We only want events strictly NEWER than the last one we successfully stored.
    const latest = await this.storage.latest();
    // We use createTime as the primary cursor because it's standard and comparable.
    // Fallback to epoch 0 if storage is empty.
    let highWaterMark = latest?.createTime
      ? new Date(latest.createTime).getTime()
      : 0;
    // We also track the specific ID of the latest to handle events with identical timestamps.
    let lastSeenId = latest?.id;

    // 2. Start crude polling from the raw network source
    for await (const activity of this.network.rawStream()) {
      const actTime = new Date(activity.createTime).getTime();

      // 3. Deduplication Filter
      // If this activity is older than our high-water mark, skip it.
      if (actTime < highWaterMark) {
        continue;
      }

      // If it has the exact same time, we need to check IDs to avoid double-processing
      // the exact same event we used as our mark.
      if (actTime === highWaterMark && activity.id === lastSeenId) {
        continue;
      }

      // 4. It's new! Persist it FIRST for crash consistency.
      await this.storage.append(activity);

      // 5. Update our in-memory watermarks
      highWaterMark = actTime;
      lastSeenId = activity.id;

      // 6. Yield to the application
      yield activity;
    }
  }

  /**
   * Returns a combined stream of history and updates.
   * This is the primary method for consuming the activity stream.
   *
   * **Behavior:**
   * 1. Yields all historical activities from local storage (offline capable).
   * 2. Switches to `updates()` to yield new activities from the network (real-time).
   */
  async *stream(): AsyncIterable<Activity> {
    // The Hybrid is just a composition of the two modalities.
    // 1. Yield everything we already know safely from disk.
    yield* this.history();

    // 2. Switch to watching for new things.
    // Because updates() re-initializes its highWaterMark when called,
    // it will correctly pick up exactly where history() ended.
    yield* this.updates();
  }

  /**
   * Queries local storage for activities matching the given options.
   */
  async select(options: SelectOptions = {}): Promise<Activity[]> {
    await this.storage.init();
    const results: Activity[] = [];

    // State machine flags for cursor handling
    let started = !options.after; // If no 'after', start immediately
    let count = 0;

    for await (const act of this.storage.scan()) {
      // 1. Handle 'after' cursor (exclusive)
      if (!started) {
        if (act.id === options.after) {
          started = true;
        }
        continue;
      }

      // 2. Handle 'before' cursor (exclusive)
      if (options.before && act.id === options.before) {
        break;
      }

      // 3. Apply filters
      if (options.type && act.type !== options.type) {
        continue;
      }

      // 4. Collect result
      results.push(act);
      count++;

      // 5. Check limits
      if (options.limit && count >= options.limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Lists activities from the network directly.
   * @param options Pagination options.
   */
  async list(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }> {
    return this.network.listActivities(options);
  }

  /**
   * Gets a single activity by ID.
   * Implements a "read-through" caching strategy.
   *
   * **Logic:**
   * 1. Checks local storage. If found, returns it immediately (fast).
   * 2. If missing, fetches from the network.
   * 3. Persists the fetched activity to storage (future reads will hit cache).
   * 4. Returns the activity.
   *
   * **Side Effects:**
   * - May perform a network request.
   * - May write to local storage.
   */
  async get(activityId: string): Promise<Activity> {
    await this.storage.init();

    // 1. Try cache first (Aggressive Caching)
    const cached = await this.storage.get(activityId);
    if (cached) {
      return cached;
    }

    // 2. Network fallback (Read-Through)
    const fresh = await this.network.fetchActivity(activityId);

    // 3. Persist for next time before returning
    // We await this to guarantee consistency.
    await this.storage.append(fresh);

    return fresh;
  }
}
