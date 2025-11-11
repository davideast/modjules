import { Platform } from '../platform.js';

export class BrowserPlatform implements Platform {
  async saveFile(): Promise<void> {
    throw new Error('Saving files is not supported in the browser.');
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
