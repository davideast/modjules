import { writeFile } from 'fs/promises';
import { Buffer } from 'buffer';
import { setTimeout } from 'timers/promises';
import { Platform } from '../platform.js';

export class NodePlatform implements Platform {
  async saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
  ): Promise<void> {
    const buffer = Buffer.from(data, encoding);
    await writeFile(filepath, buffer);
  }

  async sleep(ms: number): Promise<void> {
    await setTimeout(ms);
  }
}
