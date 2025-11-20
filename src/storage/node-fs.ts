import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Activity } from '../types.js';
import { ActivityStorage } from './types.js';

/**
 * Node.js filesystem implementation of ActivityStorage.
 * Stores activities in a JSONL file located at `.jules/cache/<sessionId>/activities.jsonl`.
 */
export class NodeFileStorage implements ActivityStorage {
  private filePath: string;
  private initialized = false;

  constructor(sessionId: string, rootDir: string = process.cwd()) {
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
