import { SessionResource, Activity } from '../types.js';
import {
  ActivityStorage,
  SessionStorage,
  CachedSession,
  SessionIndexEntry,
} from './interface.js';

export class MemoryStorage implements ActivityStorage {
  private activities = new Map<string, Activity>();

  async init(): Promise<void> {}
  async close(): Promise<void> {
    this.activities.clear();
  }

  async append(activity: Activity): Promise<void> {
    this.activities.set(activity.id, activity);
  }

  async appendActivities(activities: Activity[]): Promise<void> {
    for (const a of activities) this.activities.set(a.id, a);
  }

  async writeActivities(activities: Activity[]): Promise<void> {
    this.activities.clear();
    for (const a of activities) this.activities.set(a.id, a);
  }

  async get(activityId: string): Promise<Activity | undefined> {
    return this.activities.get(activityId);
  }

  async latest(): Promise<Activity | undefined> {
    let latest: Activity | undefined;
    for (const a of this.activities.values()) {
      if (!latest || a.createTime > latest.createTime) {
        latest = a;
      }
    }
    return latest;
  }

  async *scan(): AsyncIterable<Activity> {
    const sorted = [...this.activities.values()].sort((a, b) =>
      a.createTime.localeCompare(b.createTime),
    );
    for (const a of sorted) {
      yield a;
    }
  }
}

export class MemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, CachedSession>();
  private index = new Map<string, SessionIndexEntry>();

  async init(): Promise<void> {}

  async upsert(session: SessionResource): Promise<void> {
    this.sessions.set(session.id, {
      resource: session,
      _lastSyncedAt: Date.now(),
    });
    this.index.set(session.id, {
      id: session.id,
      title: session.title,
      state: session.state,
      createTime: session.createTime,
      source: session.sourceContext?.source || 'unknown',
      _updatedAt: Date.now(),
    });
  }

  async upsertMany(sessions: SessionResource[]): Promise<void> {
    for (const session of sessions) {
      await this.upsert(session);
    }
  }

  async get(sessionId: string): Promise<CachedSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.index.delete(sessionId);
  }

  async *scanIndex(): AsyncIterable<SessionIndexEntry> {
    for (const entry of this.index.values()) {
      yield entry;
    }
  }

  async updateSessionIndex(
    sessionId: string,
    updates: Partial<Omit<SessionIndexEntry, 'id'>>,
  ): Promise<void> {
    const existing = this.index.get(sessionId);
    if (existing) {
      this.index.set(sessionId, {
        ...existing,
        ...updates,
        _updatedAt: Date.now(),
      });
    }
  }

  async getActivityHighWaterMark(sessionId: string): Promise<string | null> {
    return this.index.get(sessionId)?.activityHighWaterMark ?? null;
  }

  async getSessionIndexEntry(
    sessionId: string,
  ): Promise<SessionIndexEntry | undefined> {
    return this.index.get(sessionId);
  }

  async appendActivities(
    sessionId: string,
    activities: Activity[],
  ): Promise<void> {
    if (activities.length === 0) return;

    const latestActivity = activities[activities.length - 1];
    const existing = this.index.get(sessionId);

    this.index.set(sessionId, {
      ...existing!,
      activityCount: (existing?.activityCount || 0) + activities.length,
      activityHighWaterMark: latestActivity.createTime,
    });
  }

  async writeActivities(
    sessionId: string,
    activities: Activity[],
  ): Promise<void> {
    if (activities.length > 0) {
      const latestActivity = activities[activities.length - 1];
      this.index.set(sessionId, {
        ...this.index.get(sessionId)!,
        activityCount: activities.length,
        activityHighWaterMark: latestActivity.createTime,
      });
    }
  }
}
