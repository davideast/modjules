import { Activity, SessionResource } from '../types.js';

export type CachedSession = {
  resource: SessionResource;
  _lastSyncedAt: number;
};

export type SessionIndexEntry = {
  id: string;
  title: string;
  state: string;
  createTime: string;
  source: string;
  _updatedAt: number;
  activityCount?: number;
  activityHighWaterMark?: string;
};

export interface SessionStorage {
  init(): Promise<void>;
  upsert(session: SessionResource): Promise<void>;
  upsertMany(sessions: SessionResource[]): Promise<void>;
  get(sessionId: string): Promise<CachedSession | undefined>;
  delete(sessionId: string): Promise<void>;
  scanIndex(): AsyncIterable<SessionIndexEntry>;
  updateSessionIndex(
    sessionId: string,
    updates: Partial<Omit<SessionIndexEntry, 'id'>>,
  ): Promise<void>;
  getActivityHighWaterMark(sessionId: string): Promise<string | null>;
  getSessionIndexEntry(
    sessionId: string,
  ): Promise<SessionIndexEntry | undefined>;
  appendActivities(sessionId: string, activities: Activity[]): Promise<void>;
  writeActivities(sessionId: string, activities: Activity[]): Promise<void>;
}

export interface ActivityStorage {
  init(): Promise<void>;
  close(): Promise<void>;
  append(activity: Activity): Promise<void>;
  get(activityId: string): Promise<Activity | undefined>;
  latest(): Promise<Activity | undefined>;
  scan(): AsyncIterable<Activity>;
}
