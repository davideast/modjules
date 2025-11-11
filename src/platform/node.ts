import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers/promises';
import { Platform } from './types.js';

export class NodePlatform implements Platform {
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
