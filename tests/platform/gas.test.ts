import { vi, beforeEach, describe } from 'vitest';
import crypto from 'node:crypto';
import { GasPlatform } from '../../src/platform/gas';
import { runPlatformTests } from './contract';

// 1. Mock Globals BEFORE usage
const mockUrlFetch = vi.fn();
const mockUtilities = {
  getUuid: () => crypto.randomUUID(),
  computeHmacSha256Signature: (text: string, key: string) => {
    // We use Node's crypto to simulate GAS's crypto behavior perfectly
    // This ensures our ADAPTER logic is correct, assuming GAS works as documented.
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(text);
    // GAS returns byte[] (Array<number>)
    return Array.from(hmac.digest());
  },
  base64EncodeWebSafe: (bytes: number[]) => {
    // GAS Utilities.base64EncodeWebSafe takes byte[] and returns string
    return Buffer.from(bytes).toString('base64url');
  },
  base64DecodeWebSafe: (text: string) => {
    // GAS Utilities.base64DecodeWebSafe takes string and returns byte[]
    return Array.from(Buffer.from(text, 'base64url'));
  },
  newBlob: (data: any) => {
    // Mock GAS Blob
    const buffer =
      typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    return {
      getBytes: () => Array.from(buffer),
      getDataAsString: () => buffer.toString('utf-8'),
    };
  },
  sleep: vi.fn(),
};

// Stubbing globals for GAS
vi.stubGlobal('UrlFetchApp', { fetch: mockUrlFetch });
vi.stubGlobal('Utilities', mockUtilities);

describe('GasPlatform', () => {
  beforeEach(() => {
    mockUrlFetch.mockReset();
    // Default network mock behavior for GAS
    // UrlFetchApp.fetch returns an object with getResponseCode, getContentText, etc.
    mockUrlFetch.mockImplementation((url: string) => {
      if (url.includes('/json')) {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ slideshow: {} }),
        };
      }
      if (url.includes('/status/404')) {
        return {
          getResponseCode: () => 404,
          getContentText: () => 'Not Found',
        };
      }
      return {
        getResponseCode: () => 500,
        getContentText: () => 'Error',
      };
    });
  });

  runPlatformTests('Google Apps Script', new GasPlatform());
});
