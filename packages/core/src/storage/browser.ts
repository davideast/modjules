import { openDB, IDBPDatabase } from 'idb';
import { Activity } from '../types.js';
import { ActivityStorage } from './types.js';

const DB_NAME = 'jules-activities';
const STORE_NAME = 'activities';

/**
 * Browser implementation of ActivityStorage using IndexedDB.
 * Allows for persistent storage of activities in the browser.
 */
export class BrowserStorage implements ActivityStorage {
  private sessionId: string;
  private dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  private getDb(): Promise<IDBPDatabase<unknown>> {
    if (!this.dbPromise) {
      // We use version 2 here as well to match BrowserPlatform and avoid conflicts.
      // We don't necessarily need to know about 'artifacts' store here, but we must use the same version.
      this.dbPromise = openDB(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          if (oldVersion < 1) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, {
                keyPath: 'id',
              });
              // Index to efficiently find the latest activity for a session
              store.createIndex('sessionTimestamp', 'sessionTimestamp');
            }
          }
          // Ensure artifacts store exists if we are upgrading to v2 or from scratch
          // This might duplicate logic in BrowserPlatform, but it's safer if both can upgrade.
          if (!db.objectStoreNames.contains('artifacts')) {
            const store = db.createObjectStore('artifacts', {
              keyPath: 'filepath',
            });
            store.createIndex('activityId', 'activityId');
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Initializes the storage.
   *
   * **Side Effects:**
   * - Opens an IndexedDB connection.
   * - Upgrades the database schema to v2 if necessary (creating object stores).
   */
  async init(): Promise<void> {
    // openDB handles initialization, so just call it to ensure DB is ready.
    await this.getDb();
  }

  /**
   * Closes the storage connection.
   */
  async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }
  }

  /**
   * Appends an activity to IndexedDB.
   *
   * **Side Effects:**
   * - Adds a `sessionId` field to the activity for indexing.
   * - Writes the modified activity to the `activities` object store.
   */
  async append(activity: Activity): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Add a compound key for indexing
    const storableActivity = {
      ...activity,
      sessionId: this.sessionId,
      sessionTimestamp: `${this.sessionId}-${activity.createTime}`,
    };
    await store.put(storableActivity);
    await tx.done;
  }

  /**
   * Retrieves an activity by ID.
   */
  async get(activityId: string): Promise<Activity | undefined> {
    const db = await this.getDb();
    const activity = await db.get(STORE_NAME, activityId);
    // Strip internal properties before returning
    if (activity) {
      delete (activity as any).sessionId;
      delete (activity as any).sessionTimestamp;
    }
    return activity as Activity | undefined;
  }

  /**
   * Retrieves the latest activity for the current session.
   *
   * **Logic:**
   * - Uses the `sessionTimestamp` index to query efficiently.
   * - Opens a cursor in 'prev' direction to find the last entry first.
   */
  async latest(): Promise<Activity | undefined> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionTimestamp');

    // Create a key range for just this session
    const range = IDBKeyRange.bound(
      `${this.sessionId}-`,
      `${this.sessionId}-\uffff`,
    );

    const cursor = await index.openCursor(range, 'prev');
    if (!cursor) {
      return undefined;
    }
    const activity = cursor.value;
    // Strip internal properties before returning
    if (activity) {
      delete (activity as any).sessionId;
      delete (activity as any).sessionTimestamp;
    }
    return activity as Activity | undefined;
  }

  /**
   * Yields all activities for the current session.
   */
  async *scan(): AsyncIterable<Activity> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionTimestamp');

    const range = IDBKeyRange.bound(
      `${this.sessionId}-`,
      `${this.sessionId}-\uffff`,
    );

    let cursor = await index.openCursor(range, 'next');

    while (cursor) {
      const activity = cursor.value;
      if (activity) {
        delete (activity as any).sessionId;
        delete (activity as any).sessionTimestamp;
      }
      yield activity as Activity;
      cursor = await cursor.continue();
    }
  }
}
