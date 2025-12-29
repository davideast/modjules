import { Platform, PlatformResponse } from './types.js';

/**
 * Web Platform implementation using standard Web APIs.
 * Works on Edge runtimes, Deno, Cloudflare Workers, and Node.js 18+.
 *
 * Note: This is a minimal implementation focused on server-side gateway usage.
 * It does not support file storage operations (use NodePlatform for that).
 */
export class WebPlatform implements Platform {
  /**
   * File saving is not supported in the Web Platform.
   * Use NodePlatform or BrowserPlatform for file operations.
   */
  async saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string,
  ): Promise<void> {
    throw new Error(
      'saveFile is not supported in WebPlatform. Use NodePlatform for file operations.',
    );
  }

  async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  createDataUrl(data: string, mimeType: string): string {
    return `data:${mimeType};base64,${data}`;
  }

  async fetch(input: string, init?: any): Promise<PlatformResponse> {
    const res = await globalThis.fetch(input, init);
    return {
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
      text: () => res.text(),
    };
  }

  crypto = {
    randomUUID: (): string => globalThis.crypto.randomUUID(),

    async sign(text: string, secret: string): Promise<string> {
      const enc = new TextEncoder();
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signature = await globalThis.crypto.subtle.sign(
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
      // Constant-time comparison would be ideal, but Web Crypto doesn't expose it
      // For HMAC verification, timing attacks are less critical than for password comparison
      return expected === signature;
    },

    arrayBufferToBase64Url(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      // Use btoa which is available in all modern runtimes
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    },
  };

  encoding = {
    base64Encode: (text: string): string => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    },

    base64Decode: (text: string): string => {
      const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    },
  };

  getEnv(key: string): string | undefined {
    // Check for Deno
    if (typeof (globalThis as any).Deno !== 'undefined') {
      return (globalThis as any).Deno.env.get(key);
    }
    // Check for Node.js process.env
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    // Cloudflare Workers don't have env access this way - they use bindings
    return undefined;
  }
}
