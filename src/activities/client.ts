import { Activity } from '../types.js';
import { ActivityStorage } from '../storage/types.js';
import { ActivityClient, ListOptions, SelectOptions } from './types.js';

// Minimal interface for the raw network source.
// In prod, this will be wrapped around the standard julets REST client.
export interface RawNetworkStream {
  /**
   * Should yield ALL activities from the server, ideally from the beginning of time
   * or a reasonably far-back point, to ensure we don't miss anything.
   * It must keep yielding indefinitely as new events arrive (polling internally).
   */
  rawStream(): AsyncIterable<Activity>;
}

export class DefaultActivityClient implements ActivityClient {
  constructor(
    private storage: ActivityStorage,
    private network: RawNetworkStream,
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

  async select(options?: SelectOptions): Promise<Activity[]> {
    throw new Error("Method 'select()' not yet implemented.");
  }

  async list(
    options?: ListOptions,
  ): Promise<{ activities: Activity[]; nextPageToken?: string }> {
    throw new Error("Method 'list()' not yet implemented.");
  }

  async get(activityId: string): Promise<Activity> {
    throw new Error("Method 'get()' not yet implemented.");
  }
}
