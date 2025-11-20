import { Activity } from '../types.js';
import { ActivityStorage } from './types.js';

/**
 * In-memory implementation of ActivityStorage.
 * Useful for testing or environments where persistence is not required.
 */
export class MemoryStorage implements ActivityStorage {
  private activities: Activity[] = [];

  /**
   * Initializes the storage. No-op for memory storage.
   */
  async init(): Promise<void> {
    // No-op for memory
  }

  /**
   * Closes the storage and clears memory.
   */
  async close(): Promise<void> {
    this.activities = []; // Clear memory on close
  }

  /**
   * Appends an activity to the in-memory list.
   *
   * **Guarantee:**
   * - Idempotent: If an activity with the same ID exists, it updates it in place.
   * - Append-only: New activities are always added to the end.
   *
   * **Side Effects:**
   * - Modifies the internal `activities` array.
   */
  async append(activity: Activity): Promise<void> {
    // Upsert logic to maintain idempotency contract
    const index = this.activities.findIndex((a) => a.id === activity.id);
    if (index >= 0) {
      // Maintain original position
      this.activities[index] = activity;
    } else {
      this.activities.push(activity);
    }
  }

  /**
   * Retrieves an activity by ID.
   */
  async get(activityId: string): Promise<Activity | undefined> {
    return this.activities.find((a) => a.id === activityId);
  }

  /**
   * Retrieves the latest activity.
   */
  async latest(): Promise<Activity | undefined> {
    if (this.activities.length === 0) return undefined;
    return this.activities[this.activities.length - 1];
  }

  /**
   * Yields all activities in chronological order.
   */
  async *scan(): AsyncIterable<Activity> {
    for (const activity of this.activities) {
      yield activity;
    }
  }
}
