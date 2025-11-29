import { Identity } from '../auth/types.js';
import { Platform } from '../platform/types.js';

/**
 * 1. The Resource Shape
 * Any data object returned by a database strategy must at least
 * have an ownerId to support the "Security by Default" fallback.
 */
export interface ProtectedResource {
  ownerId: string;
  [key: string]: any;
}

/**
 * 2. The Strategy Contract
 * The Server Core treats this as a black box.
 * - Input: User Identity + Session ID
 * - Output: The Resource Data (if allowed)
 * - Behavior: Throws Error if denied or not found.
 */
export type AuthorizationStrategy<T extends ProtectedResource = any> = (
  user: Identity,
  sessionId: string,
) => Promise<T>;

export type VerifyCallback = (
  authToken: string,
  platform: Platform,
) => Promise<Identity | string>;

export interface ServerConfig {
  /** The Google API Key for the Jules API */
  apiKey: string;
  /** The secret used to sign Browser Capability Tokens */
  clientSecret: string;
  /** Callback to verify the user's identity provider token */
  verify: VerifyCallback;
  authorize: AuthorizationStrategy; // Authorization <--- NEW
}

/** Normalized Request (Abstracts Express/Next/GAS) */
export interface ServerRequest {
  method: string;
  path: string; // e.g., "/sessions/123"
  headers: Record<string, string>;
  body?: any;
}
