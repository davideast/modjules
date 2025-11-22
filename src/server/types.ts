import { Platform } from '../platform/types.js';

export interface Identity {
  uid: string;
  email?: string;
}

export type VerifyCallback = (authToken: string) => Promise<Identity | string>;

export interface ServerConfig {
  /** The Google API Key for the Jules API */
  apiKey: string;
  /** The secret used to sign Browser Capability Tokens */
  clientSecret: string;
  /** Callback to verify the user's identity provider token */
  verify: VerifyCallback;
}

/** Normalized Request (Abstracts Express/Next/GAS) */
export interface ServerRequest {
  method: string;
  path: string; // e.g., "/sessions/123"
  headers: Record<string, string>;
  body?: any;
}
