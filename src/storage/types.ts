import { Activity } from '../types.js';

/**
 * Abstract interface for the isomorphic storage layer.
 * Implementations handle the specifics of persisting immutable activities
 * to the available medium (Filesystem, IndexedDB, Memory, etc.).
 */
export interface ActivityStorage {
  /**
   * Lifecycle method to initialize the storage (e.g., open DB connection, ensure storage directory exists).
   * Must be called before any other method.
   */
  init(): Promise<void>;

  /**
   * Lifecycle method to close connections or flush buffers.
   */
  close(): Promise<void>;

  /**
   * Persists a single activity.
   * Implementations MUST guarantee this is an append-only operation (or upsert if ID matches).
   * It should NEVER delete or modify a different activity.
   */
  append(activity: Activity): Promise<void>;

  /**
   * Retrieves a specific activity by its ID.
   * @returns The activity if found, or undefined.
   */
  get(activityId: string): Promise<Activity | undefined>;

  /**
   * Retrieves the most recently appended activity.
   * Crucial for determining the high-water mark for network synchronization.
   */
  latest(): Promise<Activity | undefined>;

  /**
   * Yields all stored activities in chronological order (insertion order).
   * Must support standard 'for await...of' loops.
   */
  scan(): AsyncIterable<Activity>;
}
