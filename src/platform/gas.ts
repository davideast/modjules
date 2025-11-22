import { Platform, PlatformResponse } from './types.js';

// Declare GAS globals to satisfy TypeScript
declare const Utilities: any;
declare const UrlFetchApp: any;
declare const ContentService: any;

export class GasPlatform implements Platform {
  async saveFile(): Promise<void> {
    // No-op: GAS typically doesn't save files to a local "disk"
    // Could optionally implement DriveApp saving here.
  }

  async sleep(ms: number): Promise<void> {
    Utilities.sleep(ms);
  }

  createDataUrl(data: string, mimeType: string): string {
    return `data:${mimeType};base64,${data}`;
  }

  async fetch(input: string, init?: any): Promise<PlatformResponse> {
    // GAS UrlFetchApp is synchronous/blocking
    const params: any = {
      method: init?.method || 'get',
      headers: init?.headers || {},
      payload: init?.body,
      muteHttpExceptions: true, // Return 400/500s instead of throwing
      followRedirects: true,
    };

    const response = UrlFetchApp.fetch(input, params);
    const code = response.getResponseCode();

    return {
      ok: code >= 200 && code < 300,
      status: code,
      // Wrap synchronous results in Promises to match the Interface
      json: async () => JSON.parse(response.getContentText()),
      text: async () => response.getContentText(),
    };
  }

  crypto = {
    randomUUID: () => Utilities.getUuid(),

    async sign(text: string, secret: string): Promise<string> {
      // GAS has built-in HMAC utilities
      const signature = Utilities.computeHmacSha256Signature(text, secret);
      // Uses WebSafe (Base64Url) encoding directly
      return Utilities.base64EncodeWebSafe(signature);
    },

    async verify(
      text: string,
      signature: string,
      secret: string,
    ): Promise<boolean> {
      const expected = await this.sign(text, secret);
      return expected === signature;
    },
  };
}
