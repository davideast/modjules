import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Activity } from '../types.js';
import { ActivityStorage } from './types.js';

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

  async init(): Promise<void> {
    if (this.initialized) return;
    // Ensure the cache directory exists before we ever try to read/write
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.initialized = true;
  }

  async close(): Promise<void> {
    // No persistent handles to close in this simple V1 implementation.
    this.initialized = false;
  }

  async append(activity: Activity): Promise<void> {
    // Safety check: ensure init() was called if the user forgot
    if (!this.initialized) await this.init();

    const line = JSON.stringify(activity) + '\n';
    // 'utf8' is standard. appendFile handles opening/closing the file handle automatically.
    await fs.appendFile(this.filePath, line, 'utf8');
  }

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

  async latest(): Promise<Activity | undefined> {
    // V1 Implementation: Full Scan to find the end.
    let last: Activity | undefined;
    for await (const act of this.scan()) {
      last = act;
    }
    return last;
  }

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
