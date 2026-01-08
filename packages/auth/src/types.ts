export interface Identity {
  uid: string;
  email?: string;
  [key: string]: unknown; // Custom claims
}

export type Scope = 'read' | 'write' | 'admin';

export interface AuthorizationResult {
  scopes: Scope[];
  /** Optional: Return the raw resource if needed for caching/logging */
  resource?: any;
}

export interface ProtectedResource {
  ownerId: string;
  [key: string]: any;
}

export type VerifyCallback = (
  authToken: string,
  platform: Platform,
) => Promise<Identity | string>;

export type AuthorizationStrategy = (
  user: Identity,
  sessionId: string,
) => Promise<AuthorizationResult>;

/**
 * A unified response interface that works across Node, Browser, and GAS.
 */
export interface PlatformResponse {
  ok: boolean;
  status: number;
  json<T = any>(): Promise<T>;
  text(): Promise<string>;
}

/**
 * Abstract interface for platform-specific functionality.
 * Allows the SDK to run in both Node.js, browser, and Google Apps Script environments.
 */
export interface Platform {
  /**
   * Saves a file to the platform's filesystem.
   */
  saveFile(
    filepath: string,
    data: string,
    encoding: 'base64',
    activityId?: string,
  ): Promise<void>;

  /**
   * Pauses execution for the specified duration.
   */
  sleep(ms: number): Promise<void>;

  /**
   * Creates a data URL for the given data.
   */
  createDataUrl(data: string, mimeType: string): string;

  /**
   * Unified network fetch.
   */
  fetch(input: string, init?: any): Promise<PlatformResponse>;

  /**
   * Unified crypto operations.
   */
  crypto: {
    /**
     * Generates a standard UUID v4.
     */
    randomUUID(): string;

    /**
     * Signs a string using HMAC-SHA256 and returns a Base64Url encoded string.
     * Used for minting Capability Tokens.
     */
    sign(text: string, secret: string): Promise<string>;

    /**
     * Verifies a signature.
     */
    verify(text: string, signature: string, secret: string): Promise<boolean>;
  };

  /**
   * Unified encoding/decoding operations.
   */
  encoding: {
    /**
     * Encodes a string to Base64URL format.
     * (URL-safe: '-' instead of '+', '_' instead of '/', no padding)
     */
    base64Encode(text: string): string;

    /**
     * Decodes a Base64URL encoded string.
     */
    base64Decode(text: string): string;
  };

  /**
   * Retrieves an environment variable or configuration value.
   *
   * @param key The name of the environment variable (e.g., "JULES_API_KEY").
   * @returns The value of the environment variable, or `undefined` if not set.
   */
  getEnv(key: string): string | undefined;

  // These are optional because they are only used for checkpointing,
  // which is a Node-specific feature.
  readFile?(path: string): Promise<string>;
  writeFile?(path: string, content: string): Promise<void>;
  deleteFile?(path: string): Promise<void>;
}
