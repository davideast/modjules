import { Activity } from '../types.js';
import { ActivityStorage } from './types.js';

export class MemoryStorage implements ActivityStorage {
  private activities: Activity[] = [];

  async init(): Promise<void> {
    // No-op for memory
  }

  async close(): Promise<void> {
    this.activities = []; // Clear memory on close
  }

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

  async get(activityId: string): Promise<Activity | undefined> {
    return this.activities.find((a) => a.id === activityId);
  }

  async latest(): Promise<Activity | undefined> {
    if (this.activities.length === 0) return undefined;
    return this.activities[this.activities.length - 1];
  }

  async *scan(): AsyncIterable<Activity> {
    for (const activity of this.activities) {
      yield activity;
    }
  }
}
