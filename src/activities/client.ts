import { Activity } from '../types.js';
import { ActivityStorage } from '../storage/types.js';
import { ActivityClient, ListOptions, SelectOptions } from './types.js';

export class DefaultActivityClient implements ActivityClient {
  constructor(
    private storage: ActivityStorage,
    // We will need the network client later for updates/list/get,
    // but for this specific task (Priority 1.3 + 1.4), we only need storage.
    // private network: NetworkClient
  ) {}

  async *history(): AsyncIterable<Activity> {
    // Ensure storage is ready before we start yielding
    await this.storage.init();

    // Idiomatic delegation to the storage's generator.
    // This yields every item from storage.scan() one by one.
    yield* this.storage.scan();
  }

  async *updates(): AsyncIterable<Activity> {
    throw new Error("Method 'updates()' not yet implemented.");
  }

  async *stream(): AsyncIterable<Activity> {
    throw new Error("Method 'stream()' not yet implemented.");
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
