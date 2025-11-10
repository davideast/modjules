import { Activity } from '../types.js';
import { ActivityStorage } from '../storage/types.js';
import { ActivityClient, ListOptions, SelectOptions } from './types.js';

// Upgraded interface to support P3 requirements.
// In a real app, this might live in src/network/types.ts
export interface NetworkClient {
  rawStream(): AsyncIterable<Activity>;
  listActivities(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }>;
  fetchActivity(activityId: string): Promise<Activity>;
}

export class DefaultActivityClient implements ActivityClient {
  constructor(
    private storage: ActivityStorage,
    private network: NetworkClient,
  ) {}

  async *history(): AsyncIterable<Activity> {
    // Ensure storage is ready before we start yielding
    await this.storage.init();

    // Idiomatic delegation to the storage's generator.
    // This yields every item from storage.scan() one by one.
    yield* this.storage.scan();
  }

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

  async *stream(): AsyncIterable<Activity> {
    // The Hybrid is just a composition of the two modalities.
    // 1. Yield everything we already know safely from disk.
    yield* this.history();

    // 2. Switch to watching for new things.
    // Because updates() re-initializes its highWaterMark when called,
    // it will correctly pick up exactly where history() ended.
    yield* this.updates();
  }

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

  async list(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }> {
    return this.network.listActivities(options);
  }

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
