import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Activity, SessionResource } from '../types.js';
import {
  ActivityStorage,
  SessionStorage,
  CachedSession,
  SessionIndexEntry,
} from './interface.js';

/**
 * Node.js filesystem implementation of ActivityStorage.
 * Stores activities in a JSONL file located at `.jules/cache/<sessionId>/activities.jsonl`.
 */
export class NodeFileStorage implements ActivityStorage {
  private filePath: string;
  private initialized = false;

  constructor(sessionId: string, rootDir: string) {
    this.filePath = path.resolve(
      rootDir,
      '.jules/cache',
      sessionId,
      'activities.jsonl',
    );
  }

  /**
   * Initializes the storage by ensuring the cache directory exists.
   *
   * **Side Effects:**
   * - Creates the `.jules/cache/<sessionId>` directory if it does not exist.
   * - Sets the internal `initialized` flag.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    // Ensure the cache directory exists before we ever try to read/write
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.initialized = true;
  }

  /**
   * Closes the storage.
   */
  async close(): Promise<void> {
    // No persistent handles to close in this simple V1 implementation.
    this.initialized = false;
  }

  /**
   * Appends an activity to the file.
   *
   * **Side Effects:**
   * - Appends a new line containing the JSON representation of the activity to `activities.jsonl`.
   * - Implicitly calls `init()` if not already initialized.
   */
  async append(activity: Activity): Promise<void> {
    // Safety check: ensure init() was called if the user forgot
    if (!this.initialized) await this.init();

    const line = JSON.stringify(activity) + '\n';
    // 'utf8' is standard. appendFile handles opening/closing the file handle automatically.
    await fs.appendFile(this.filePath, line, 'utf8');
  }

  async appendActivities(activities: Activity[]): Promise<void> {
    if (activities.length === 0) return;
    if (!this.initialized) await this.init();
    const lines = activities.map((a) => JSON.stringify(a)).join('\n') + '\n';
    await fs.appendFile(this.filePath, lines, 'utf8');
  }

  async writeActivities(activities: Activity[]): Promise<void> {
    if (!this.initialized) await this.init();
    const lines = activities.map((a) => JSON.stringify(a)).join('\n') + '\n';
    await fs.writeFile(this.filePath, lines, 'utf8');
  }

  /**
   * Retrieves an activity by ID.
   * Uses a linear scan of the file.
   */
  async get(activityId: string): Promise<Activity | undefined> {
    // V1 Implementation: Linear Scan.
    // Acceptable trade-off for simplicity as session logs are rarely massive.
    for await (const activity of this.scan()) {
      if (activity.id === activityId) {
        return activity;
      }
    }
    return undefined;
  }

  /**
   * Retrieves the latest activity.
   * Scans the entire file to find the last entry.
   */
  async latest(): Promise<Activity | undefined> {
    // V1 Implementation: Full Scan to find the end.
    let last: Activity | undefined;
    for await (const act of this.scan()) {
      last = act;
    }
    return last;
  }

  /**
   * Yields all activities in the file.
   *
   * **Behavior:**
   * - Opens a read stream to `activities.jsonl`.
   * - Reads line-by-line using `readline`.
   * - Parses each line as JSON.
   *
   * **Edge Cases:**
   * - Logs a warning and skips lines if JSON parsing fails (corrupt data).
   * - Returns immediately (yields nothing) if the file does not exist.
   */
  async *scan(): AsyncIterable<Activity> {
    if (!this.initialized) await this.init();

    try {
      await fs.access(this.filePath);
    } catch (e) {
      if ((e as any).code === 'ENOENT') {
        return; // File doesn't exist, yield nothing.
      }
      throw e;
    }

    const fileStream = createReadStream(this.filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim().length === 0) continue;
      try {
        yield JSON.parse(line) as Activity;
      } catch (e) {
        console.warn(
          `[NodeFileStorage] Corrupt JSON line ignored in ${this.filePath}`,
        );
      }
    }
  }
}

export class NodeSessionStorage implements SessionStorage {
  private cacheDir: string;
  private indexFilePath: string;
  private initialized = false;

  constructor(rootDir: string) {
    this.cacheDir = path.resolve(rootDir, '.jules/cache');
    this.indexFilePath = path.join(this.cacheDir, 'sessions.jsonl');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.cacheDir, { recursive: true });
    this.initialized = true;
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.cacheDir, sessionId, 'session.json');
  }

  async upsert(session: SessionResource): Promise<void> {
    await this.init();

    // 1. Write the Atomic "Source of Truth"
    const sessionDir = path.join(this.cacheDir, session.id);
    await fs.mkdir(sessionDir, { recursive: true });

    const cached: CachedSession = {
      resource: session,
      _lastSyncedAt: Date.now(),
    };

    // Write atomically (JSON.stringify is fast for single sessions)
    await fs.writeFile(
      path.join(sessionDir, 'session.json'),
      JSON.stringify(cached, null, 2),
      'utf8',
    );

    // 2. Update the High-Speed Index (Append-Only)
    // We strictly append. The reader is responsible for deduplication.
    const indexEntry: SessionIndexEntry = {
      id: session.id,
      title: session.title,
      state: session.state,
      createTime: session.createTime,
      source: session.sourceContext?.source || 'unknown',
      _updatedAt: Date.now(),
    };

    await fs.appendFile(
      this.indexFilePath,
      JSON.stringify(indexEntry) + '\n',
      'utf8',
    );
  }

  async upsertMany(sessions: SessionResource[]): Promise<void> {
    // Parallelize file writes, sequentialize index write
    await Promise.all(sessions.map((s) => this.upsert(s)));
  }

  async get(sessionId: string): Promise<CachedSession | undefined> {
    await this.init();
    try {
      const data = await fs.readFile(this.getSessionPath(sessionId), 'utf8');
      return JSON.parse(data) as CachedSession;
    } catch (e: any) {
      if (e.code === 'ENOENT') return undefined;
      throw e;
    }
  }

  async delete(sessionId: string): Promise<void> {
    await this.init();
    // 1. Remove the directory (Metadata + Activities + Artifacts)
    const sessionDir = path.join(this.cacheDir, sessionId);
    await fs.rm(sessionDir, { recursive: true, force: true });

    // 2. We do NOT rewrite the index here for performance.
    // The "Get" method will return 404 (undefined) which is the ultimate check.
    // Periodic compaction can clean the index later.
  }

  async *scanIndex(): AsyncIterable<SessionIndexEntry> {
    await this.init();

    // Read the raw stream
    // Note: In Phase 3 (Query Planner), we will optimize this to read backward
    // or keep an in-memory map to dedupe instantly.
    try {
      const fileStream = createReadStream(this.indexFilePath, {
        encoding: 'utf8',
      });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      // Deduplication Map: ID -> Entry
      const entries = new Map<string, SessionIndexEntry>();

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as SessionIndexEntry;
          entries.set(entry.id, entry);
        } catch (e) {
          /* ignore corrupt lines */
        }
      }

      for (const entry of entries.values()) {
        yield entry;
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') return; // No index yet
      throw e;
    }
  }

  async getSessionIndexEntry(
    sessionId: string,
  ): Promise<SessionIndexEntry | undefined> {
    await this.init();

    try {
      const fileStream = createReadStream(this.indexFilePath, {
        encoding: 'utf8',
      });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      // V1 implementation: linear scan, last-entry-wins
      let result: SessionIndexEntry | undefined;
      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as SessionIndexEntry;
          if (entry.id === sessionId) {
            // Keep overwriting, the last one we see for this ID is the most recent
            result = entry;
          }
        } catch (e) {
          /* ignore corrupt lines */
        }
      }
      return result;
    } catch (e: any) {
      if (e.code === 'ENOENT') return undefined; // No index yet
      throw e;
    }
  }

  async updateSessionIndex(
    sessionId: string,
    updates: Partial<Omit<SessionIndexEntry, 'id'>>,
  ): Promise<void> {
    await this.init();

    const existing = await this.getSessionIndexEntry(sessionId);
    if (!existing) {
      throw new Error(
        `[NodeSessionStorage] Cannot update index for non-existent session: ${sessionId}`,
      );
    }

    const updatedEntry: SessionIndexEntry = {
      ...existing,
      ...updates,
      _updatedAt: Date.now(),
    };

    await fs.appendFile(
      this.indexFilePath,
      JSON.stringify(updatedEntry) + '\n',
      'utf8',
    );
  }

  async getActivityHighWaterMark(sessionId: string): Promise<string | null> {
    const entry = await this.getSessionIndexEntry(sessionId);
    return entry?.activityHighWaterMark ?? null;
  }

  async appendActivities(
    sessionId: string,
    activities: Activity[],
  ): Promise<void> {
    if (activities.length === 0) return;
    const activityStorage = new NodeFileStorage(sessionId, this.cacheDir);
    await activityStorage.appendActivities(activities);

    const latestActivity = activities[activities.length - 1];
    const existing = await this.getSessionIndexEntry(sessionId);

    await this.updateSessionIndex(sessionId, {
      activityCount: (existing?.activityCount || 0) + activities.length,
      activityHighWaterMark: latestActivity.createTime,
    });
  }

  async writeActivities(
    sessionId: string,
    activities: Activity[],
  ): Promise<void> {
    const activityStorage = new NodeFileStorage(sessionId, this.cacheDir);
    await activityStorage.writeActivities(activities);

    if (activities.length > 0) {
      const latestActivity = activities[activities.length - 1];
      await this.updateSessionIndex(sessionId, {
        activityCount: activities.length,
        activityHighWaterMark: latestActivity.createTime,
      });
    }
  }
}
