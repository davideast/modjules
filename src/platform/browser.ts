import { openDB, IDBPDatabase } from 'idb';
import { Platform, PlatformResponse } from './types.js';

const DB_NAME = 'jules-activities';
const ARTIFACTS_STORE_NAME = 'artifacts';
const ACTIVITIES_STORE_NAME = 'activities';

/**
 * Browser implementation of the Platform interface.
 * Uses IndexedDB for file storage.
 */
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

  /**
   * Saves a file to IndexedDB.
   *
   * **Data Transformation:**
   * - Decodes base64 data into a `Blob`.
   *
   * **Side Effects:**
   * - Stores the blob in the `artifacts` object store.
   * - Associates the file with the `activityId` (if provided).
   *
   * @throws {Error} If the encoding is not 'base64'.
   */
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

  async fetch(input: string, init?: any): Promise<PlatformResponse> {
    const res = await window.fetch(input, init);
    return {
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
      text: () => res.text(),
    };
  }

  crypto = {
    randomUUID: () => self.crypto.randomUUID(),

    async sign(text: string, secret: string): Promise<string> {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signature = await window.crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(text),
      );
      return this.arrayBufferToBase64Url(signature);
    },

    async verify(
      text: string,
      signature: string,
      secret: string,
    ): Promise<boolean> {
      const expected = await this.sign(text, secret);
      return expected === signature;
    },

    // Helper for Base64URL encoding in browser
    arrayBufferToBase64Url(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window
        .btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    },
  };

  encoding = {
    base64Encode: (text: string): string => {
      // Use TextEncoder for proper UTF-8 handling before Base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window
        .btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    },

    base64Decode: (text: string): string => {
      const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
      // Standard atob handles the Base64 decode, then we must interpret the bytes as UTF-8
      const binary = window.atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    },
  };

  getEnv(key: string): string | undefined {
    // In bundler environments (Vite, Webpack, etc.), process.env is often polyfilled or replaced.
    // We check for its existence safely, but avoid direct usage of the 'process' global
    // to prevent build tools from assuming a Node.js environment or failing on strict checks.
    const globalRef =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
          ? window
          : typeof self !== 'undefined'
            ? self
            : {};
    const anyGlobal = globalRef as any;

    if (
      anyGlobal.process &&
      anyGlobal.process.env &&
      anyGlobal.process.env[key]
    ) {
      return anyGlobal.process.env[key];
    }

    // Fallback to window.__MODJULES__ for manual configuration injection
    if (
      typeof window !== 'undefined' &&
      (window as any).__MODJULES__ &&
      (window as any).__MODJULES__[key]
    ) {
      return (window as any).__MODJULES__[key];
    }

    return undefined;
  }
}
// triggering ci
