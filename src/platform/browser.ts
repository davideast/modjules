import { openDB, IDBPDatabase } from 'idb';
import { Platform } from './types.js';

const DB_NAME = 'jules-activities';
const ARTIFACTS_STORE_NAME = 'artifacts';
const ACTIVITIES_STORE_NAME = 'activities';

export class BrowserPlatform implements Platform {
  private dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

  private getDb(): Promise<IDBPDatabase<unknown>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Ensure activities store exists (copied from BrowserStorage to avoid race conditions)
          if (!db.objectStoreNames.contains(ACTIVITIES_STORE_NAME)) {
            const store = db.createObjectStore(ACTIVITIES_STORE_NAME, {
              keyPath: 'id',
            });
            store.createIndex('sessionTimestamp', ['sessionId', 'createTime']);
          }
          // Ensure artifacts store exists
          if (!db.objectStoreNames.contains(ARTIFACTS_STORE_NAME)) {
            const store = db.createObjectStore(ARTIFACTS_STORE_NAME, {
              keyPath: 'filepath',
            });
            store.createIndex('activityId', 'activityId');
          }
        },
      });
    }
    return this.dbPromise;
  }

  async saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string,
  ): Promise<void> {
    if (encoding !== 'base64') {
      throw new Error(`Unsupported encoding for browser saveFile: ${encoding}`);
    }
    const db = await this.getDb();
    const blob = this.base64ToBlob(data);

    await db.put(ARTIFACTS_STORE_NAME, {
      filepath,
      blob,
      activityId,
      createdAt: new Date().toISOString(),
    });
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  createDataUrl(data: string, mimeType: string): string {
    return `data:${mimeType};base64,${data}`;
  }

  private base64ToBlob(data: string, mimeType?: string): Blob {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], mimeType ? { type: mimeType } : undefined);
  }
}
