import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers/promises';
import { Platform } from './types.js';

/**
 * Node.js implementation of the Platform interface.
 */
export class NodePlatform implements Platform {
  /**
   * Saves a file to the local filesystem using `node:fs/promises`.
   *
   * **Side Effects:**
   * - Writes a file to disk.
   * - Overwrites the file if it already exists.
   */
  async saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string, // unused in Node.js, standard filesystem doesn't support this metadata easily
  ): Promise<void> {
    const buffer = Buffer.from(data, encoding);
    await writeFile(filepath, buffer);
  }

  async sleep(ms: number): Promise<void> {
    await setTimeout(ms);
  }

  createDataUrl(data: string, mimeType: string): string {
    return `data:${mimeType};base64,${data}`;
  }
}
